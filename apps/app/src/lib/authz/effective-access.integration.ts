import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import type {
	ListMemberAccessInput,
	ResourcePrincipalIdentity,
} from "@orcai/schema";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

/**
 * A member who reaches three of the admin's blocks three ways: Alpha granted
 * to them as viewer, Beta to their group as editor, Gamma public.
 */
const sharedBlocks = async () => {
	const procedures = await run(Procedures);
	const {
		actors: [admin, member],
		zedToken: created,
	} = await organizationWith([
		"admin",
		"member",
	]);
	let zedToken = created;

	const block = async (name: string) => {
		const { data, meta } = await run(
			procedures.block.create(
				{
					type: "template",
					name,
					description: null,
					contentJson: null,
					status: "draft",
					config: {
						systemPrompt: "",
					},
				},
				await procedureOptions(admin, zedToken),
			),
		);
		zedToken = meta?.zedToken ?? zedToken;
		return data.id;
	};
	const share = async (
		blockId: BlockId,
		principal: ResourcePrincipalIdentity,
		role: "viewer" | "editor",
	) => {
		const { meta } = await run(
			procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: blockId,
					principals: [
						principal,
					],
					role,
				},
				await procedureOptions(admin, zedToken),
			),
		);
		zedToken = meta?.zedToken ?? zedToken;
	};

	const { data: team, meta: teamMeta } = await run(
		procedures.group.create(
			{
				name: "Integration team",
				description: null,
			},
			await procedureOptions(admin, zedToken),
		),
	);
	zedToken = teamMeta?.zedToken ?? zedToken;
	const { meta: joinedMeta } = await run(
		procedures.group.addMembers(
			{
				groupId: team.id,
				userIds: [
					member.user.id,
				],
			},
			await procedureOptions(admin, zedToken),
		),
	);
	zedToken = joinedMeta?.zedToken ?? zedToken;

	const alpha = await block("Alpha notes");
	const beta = await block("Beta notes");
	const gamma = await block("Gamma notes");
	await share(
		alpha,
		{
			principalType: "user",
			principalId: member.user.id,
		},
		"viewer",
	);
	await share(
		beta,
		{
			principalType: "group",
			principalId: team.id,
		},
		"editor",
	);
	const { meta } = await run(
		procedures.resource.setVisibility(
			{
				resourceType: "block",
				resourceId: gamma,
				visibility: "public",
			},
			await procedureOptions(admin, zedToken),
		),
	);
	zedToken = meta?.zedToken ?? zedToken;

	const listAccess = async (
		actor: Actor,
		input: Partial<Omit<ListMemberAccessInput, "userId">> = {},
	) => {
		const { data, rowCount } = await run(
			procedures.organizationMember.listAccess(
				{
					userId: member.user.id,
					pageIndex: 0,
					pageSize: 20,
					sort: [],
					...input,
				},
				await procedureOptions(actor, zedToken),
			),
		);
		return {
			rows: data.map(
				(entry) => `${entry.resourceName}:${entry.role}:${entry.source}`,
			),
			rowCount,
		};
	};

	return {
		admin,
		member,
		listAccess,
	};
};

describe("effective access", () => {
	test(
		"lists each resource with its role and the strongest source, by name",
		async () => {
			const { admin, listAccess } = await sharedBlocks();

			expect(await listAccess(admin)).toEqual({
				rows: [
					"Alpha notes:viewer:direct:user",
					"Beta notes:editor:direct:group",
					"Gamma notes:viewer:public",
				],
				rowCount: 3,
			});
		},
		TIMEOUT,
	);

	test(
		"filters, searches, sorts and pages on the server",
		async () => {
			const { member, listAccess } = await sharedBlocks();

			expect(
				await listAccess(member, {
					filters: {
						source: "public",
					},
				}),
			).toEqual({
				rows: [
					"Gamma notes:viewer:public",
				],
				rowCount: 1,
			});
			expect(
				await listAccess(member, {
					filters: {
						search: "beta",
						resourceType: "block",
					},
				}),
			).toEqual({
				rows: [
					"Beta notes:editor:direct:group",
				],
				rowCount: 1,
			});
			expect(
				await listAccess(member, {
					filters: {
						resourceType: "bot",
					},
				}),
			).toEqual({
				rows: [],
				rowCount: 0,
			});
			expect(
				await listAccess(member, {
					pageIndex: 1,
					pageSize: 2,
					sort: [
						{
							id: "resourceName",
							desc: true,
						},
					],
				}),
			).toEqual({
				rows: [
					"Alpha notes:viewer:direct:user",
				],
				rowCount: 3,
			});
		},
		TIMEOUT,
	);
});
