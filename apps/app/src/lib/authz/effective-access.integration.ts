import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import type {
	ListMemberAccessInput,
	ResourcePrincipalIdentity,
} from "@orcai/schema";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, caller } = appIntegration();

/**
 * A member who reaches three of the admin's blocks three ways: Alpha granted
 * to them as viewer, Beta to their group as editor, Gamma public.
 */
const sharedBlocks = async () => {
	const procedures = await run(Procedures);
	const {
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const { call } = caller(zedToken);

	const block = async (name: string) => {
		const { data } = await call(admin, (options) =>
			procedures.block.create(
				{
					type: "behaviour",
					name,
					description: null,
					contentJson: null,
					status: "draft",
					config: {
						systemPrompt: "",
					},
				},
				options,
			),
		);
		return data.id;
	};
	const share = async (
		blockId: BlockId,
		principal: ResourcePrincipalIdentity,
		role: "viewer" | "editor",
	) => {
		await call(admin, (options) =>
			procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: blockId,
					principals: [
						principal,
					],
					role,
				},
				options,
			),
		);
	};

	const { data: team } = await call(admin, (options) =>
		procedures.group.create(
			{
				name: "Integration team",
				description: null,
			},
			options,
		),
	);
	await call(admin, (options) =>
		procedures.group.addMembers(
			{
				groupId: team.id,
				userIds: [
					member.user.id,
				],
			},
			options,
		),
	);

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
	await call(admin, (options) =>
		procedures.resource.setVisibility(
			{
				resourceType: "block",
				resourceId: gamma,
				visibility: "public",
			},
			options,
		),
	);

	const listAccess = async (
		actor: Actor,
		input: Partial<Omit<ListMemberAccessInput, "userId">> = {},
	) => {
		const { data, rowCount } = await call(actor, (options) =>
			procedures.organizationMember.listAccess(
				{
					userId: member.user.id,
					pageIndex: 0,
					pageSize: 20,
					sort: [],
					...input,
				},
				options,
			),
		);
		return {
			rows: data.map(
				(entry) => `${entry.resourceName}:${entry.role}:${entry.origin}`,
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
		"lists each resource with its role and the strongest origin, by name",
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
						origin: "public",
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
