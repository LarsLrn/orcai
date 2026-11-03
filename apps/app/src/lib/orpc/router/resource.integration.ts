import { describe, expect, test } from "bun:test";
import type { AssetId, GroupId } from "@orcai/core";
import type { NamedResource } from "@orcai/schema";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, createAsset } =
	appIntegration();

describe("resource.findMany", () => {
	test(
		"names the given resources while the user can read them, and leaves out revoked, deleted and missing ones",
		async () => {
			const {
				organizationId,
				actors: [owner, colleague],
			} = await organizationWith([
				"member",
				"member",
			]);
			const procedures = await run(Procedures);
			const { asset, zedToken } = await createAsset(owner, organizationId);
			const missing = crypto.randomUUID() as AssetId;
			const find = async (actor: typeof owner, token: string | undefined) =>
				(
					await run(
						procedures.resource.findMany(
							{
								resources: [
									{
										resourceType: "asset",
										resourceId: asset.id,
									},
									{
										resourceType: "asset",
										resourceId: missing,
									},
								],
								zedToken: token,
							},
							await procedureOptions(actor, token),
						),
					)
				).data;
			const named: NamedResource[] = [
				{
					resourceType: "asset",
					resourceId: asset.id,
					name: asset.title,
				},
			];
			const principal = {
				resourceType: "asset",
				resourceId: asset.id,
				principalType: "user",
				principalId: colleague.user.id,
			} as const;

			expect(await find(owner, zedToken)).toEqual(named);
			expect(await find(colleague, zedToken)).toEqual([]);

			const granted = await run(
				procedures.resource.grant(
					{
						resourceType: "asset",
						resourceId: asset.id,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: colleague.user.id,
							},
						],
					},
					await procedureOptions(owner, zedToken),
				),
			);
			const grantToken = granted.meta?.zedToken ?? zedToken;
			expect(await find(colleague, grantToken)).toEqual(named);

			const revoked = await run(
				procedures.resource.revoke(
					principal,
					await procedureOptions(owner, grantToken),
				),
			);
			expect(
				await find(colleague, revoked.meta?.zedToken ?? grantToken),
			).toEqual([]);

			const deleted = await run(
				procedures.asset.delete(
					{
						refs: [
							{
								id: asset.id,
							},
						],
					},
					await procedureOptions(owner, grantToken),
				),
			);
			expect(await find(owner, deleted.meta?.zedToken ?? grantToken)).toEqual(
				[],
			);
		},
		TIMEOUT,
	);
});

describe("resource.listPrincipals", () => {
	test(
		"pages users, then groups, to the end of the shareable set and counts the same scope",
		async () => {
			const {
				organizationId,
				actors: [admin, ...members],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
				"member",
				"member",
			]);
			const procedures = await run(Procedures);
			let token = zedToken;
			const groupIds: GroupId[] = [];
			for (const name of [
				"Alpha",
				"Beta",
				"Gamma",
			]) {
				const { data, meta } = await run(
					procedures.group.create(
						{
							name: `${name} ${crypto.randomUUID()}`,
							description: null,
						},
						await procedureOptions(admin, token),
					),
				);
				groupIds.push(data.id);
				token = meta?.zedToken ?? token;
			}
			const created = await createAsset(admin, organizationId);
			token = created.zedToken ?? token;
			const list = async (params: {
				pageIndex: number;
				excludeGranted?: boolean;
			}) =>
				run(
					procedures.resource.listPrincipals(
						{
							resourceType: "asset",
							resourceId: created.asset.id,
							pageSize: 3,
							...params,
						},
						await procedureOptions(admin, token),
					),
				);
			const allPages = async (excludeGranted: boolean) => {
				const pages = [];
				for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
					pages.push(
						await list({
							pageIndex,
							excludeGranted,
						}),
					);
				}
				return pages;
			};
			const userIds = [
				admin,
				...members,
			].map((actor) => actor.user.id);

			const pages = await allPages(false);
			expect(pages.map((page) => page.rowCount)).toEqual([
				7,
				7,
				7,
				7,
			]);
			expect(
				pages.map((page) => page.data.map((principal) => principal.type)),
			).toEqual([
				[
					"user",
					"user",
					"user",
				],
				[
					"user",
					"group",
					"group",
				],
				[
					"group",
				],
				[],
			]);
			const seen = pages.flatMap((page) =>
				page.data.map((principal) => principal.id),
			);
			expect(new Set(seen).size).toBe(7);
			expect(seen.slice(0, 4).sort()).toEqual(
				[
					...userIds,
				].sort(),
			);
			expect(seen.slice(4).sort()).toEqual(
				[
					...groupIds,
				].sort(),
			);

			const granted = await run(
				procedures.resource.grant(
					{
						resourceType: "asset",
						resourceId: created.asset.id,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: members[0].user.id,
							},
							{
								principalType: "group",
								principalId: groupIds[0],
							},
						],
					},
					await procedureOptions(admin, token),
				),
			);
			token = granted.meta?.zedToken ?? token;
			const remaining = await allPages(true);
			const left = remaining.flatMap((page) =>
				page.data.map((principal) => principal.id),
			);
			expect(remaining[0]?.rowCount).toBe(5);
			expect(left).toHaveLength(5);
			expect(left).not.toContain(members[0].user.id);
			expect(left).not.toContain(groupIds[0]);
		},
		TIMEOUT,
	);

	test(
		"counts no user by an email the caller cannot see",
		async () => {
			const {
				organizationId,
				actors: [owner, colleague],
			} = await organizationWith([
				"member",
				"member",
			]);
			const procedures = await run(Procedures);
			const { asset, zedToken } = await createAsset(owner, organizationId);

			const byEmail = await run(
				procedures.resource.listPrincipals(
					{
						resourceType: "asset",
						resourceId: asset.id,
						principalType: "user",
						query: colleague.user.email,
					},
					await procedureOptions(owner, zedToken),
				),
			);

			expect(byEmail).toMatchObject({
				data: [],
				rowCount: 0,
			});
		},
		TIMEOUT,
	);
});
