import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { libraryIntegration } from "@/lib/library/library-integration";
import { type Actor, TIMEOUT } from "@/lib/testing/app-integration";

const { run, signIn, organization } = libraryIntegration();

/** Ends the reader's grant on the block in Postgres only, as before its tuple is removed. */
const revokeInPostgresOnly = (blockId: BlockId, reader: Actor) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.resourceGrant)
				.set({
					revokedAt: new Date(),
				})
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceId, blockId),
						eq(dbSchema.resourceGrant.principalId, reader.user.id),
					),
				);
		}),
	);

describe("recent resources", () => {
	test(
		"lists what the reader can read in the active library, newest first",
		async () => {
			const {
				admin,
				member,
				procedures,
				call,
				behaviour,
				share,
				toMember,
				observe,
			} = await organization();
			const block = (resourceId: BlockId) => ({
				resourceType: "block" as const,
				resourceId,
			});
			await behaviour(member, "Own");
			const sharedDraft = await behaviour(admin, "Shared draft", "draft");
			await share(block(sharedDraft), "viewer", toMember);
			const revoked = await behaviour(admin, "Revoked");
			await share(block(revoked), "viewer", toMember);
			await behaviour(admin, "Unshared");

			const { organization: elsewhere, zedToken } = await run(
				createOrganization({
					members: [
						{
							userId: member.user.id,
							role: "admin",
						},
					],
				}),
			);
			observe(zedToken);
			const away = await signIn(elsewhere.id, member.user.id);
			const { data: foreign } = await call(away, (options) =>
				procedures.block.create(
					{
						type: "behaviour",
						name: "Elsewhere",
						description: null,
						contentJson: null,
						status: "ready",
						config: {
							systemPrompt: "",
						},
					},
					options,
				),
			);
			await call(away, (options) =>
				procedures.resource.setVisibility(
					{
						...block(foreign.id),
						visibility: "public",
					},
					options,
				),
			);
			await revokeInPostgresOnly(revoked, member);

			const recent = async (limit: number) =>
				(
					await call(member, (options) =>
						procedures.resource.listRecent(
							{
								limit,
							},
							options,
						),
					)
				).data.map((item) => item.name);

			expect(await recent(10)).toEqual([
				"Shared draft",
				"Own",
			]);
			expect(await recent(1)).toEqual([
				"Shared draft",
			]);
		},
		TIMEOUT,
	);
});
