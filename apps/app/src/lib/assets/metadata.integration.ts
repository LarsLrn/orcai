import { describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization } from "@orcai/testing";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, signIn, procedureOptions, organizationWith, createAsset } =
	authzIntegration();

const prepared = (assetIds: AssetId[]) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					processingStatus: "completed",
				})
				.where(inArray(dbSchema.asset.id, assetIds));
		}),
	);

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(error: unknown) => error,
	);

describe("asset metadata generation", () => {
	test(
		"needs edit on the asset to generate or dismiss",
		async () => {
			const {
				organizationId,
				actors: [owner, other],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
			]);
			const { asset } = await createAsset(owner, organizationId);
			await prepared([
				asset.id,
			]);
			const procedures = await run(Procedures);

			expect(
				await rejection(
					run(
						procedures.asset.generateMetadata(
							{
								id: asset.id,
							},
							await procedureOptions(other, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
			expect(
				await rejection(
					run(
						procedures.asset.dismissMetadataSuggestion(
							{
								id: asset.id,
								generation: 0,
							},
							await procedureOptions(other, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
		},
		TIMEOUT,
	);

	test(
		"counts only prepared library assets of the active organisation the user can edit",
		async () => {
			const {
				organizationId,
				actors: [owner, other],
			} = await organizationWith([
				"member",
				"member",
			]);
			const mine = await createAsset(owner, organizationId);
			const unprepared = await createAsset(owner, organizationId);
			const theirs = await createAsset(other, organizationId);
			const { organization: elsewhere, zedToken } = await run(
				createOrganization({
					members: [
						{
							userId: owner.user.id,
							role: "member",
						},
					],
				}),
			);
			const ownerElsewhere = await signIn(elsewhere.id, owner.user.id);
			const inOtherOrganization = await createAsset(
				ownerElsewhere,
				elsewhere.id,
			);
			await prepared([
				mine.asset.id,
				theirs.asset.id,
				inOtherOrganization.asset.id,
			]);
			const procedures = await run(Procedures);
			const count = async (actor: typeof owner, token: string | undefined) =>
				(
					await run(
						procedures.asset.missingMetadata(
							{},
							await procedureOptions(actor, token),
						),
					)
				).count;

			expect(unprepared.asset.id).toBeDefined();
			expect(
				await count(
					owner,
					inOtherOrganization.zedToken ?? theirs.zedToken ?? zedToken,
				),
			).toBe(1);
			expect(
				await count(ownerElsewhere, inOtherOrganization.zedToken ?? zedToken),
			).toBe(1);
		},
		TIMEOUT,
	);
});
