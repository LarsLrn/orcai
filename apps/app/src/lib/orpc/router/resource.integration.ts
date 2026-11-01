import { describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import type { NamedResource } from "@orcai/schema";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

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
