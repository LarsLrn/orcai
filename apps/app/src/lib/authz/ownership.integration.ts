import { describe, expect, test } from "bun:test";
import type { AssetId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createBlock, createAsset } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** Changes rows behind SpiceDB's back, so only the Postgres checks see it. */
const quietly = {
	setRole: (
		organizationId: OrganizationId,
		userId: UserId,
		role: "viewer" | "member",
	) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.member)
					.set({
						role,
					})
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, userId),
						),
					);
			}),
		),
	ban: (userId: UserId) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.user)
					.set({
						banned: true,
					})
					.where(eq(dbSchema.user.id, userId));
			}),
		),
	makeChatUpload: (assetId: AssetId) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						origin: "chat",
					})
					.where(eq(dbSchema.asset.id, assetId));
			}),
		),
};

const originOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					origin: dbSchema.asset.origin,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row?.origin;
		}),
	);

const addToLibrary = async (
	actor: Actor,
	assetId: AssetId,
	zedToken?: string,
) =>
	run(
		(await run(Procedures)).asset.addToLibrary(
			{
				id: assetId,
			},
			await procedureOptions(actor, zedToken),
		),
	);

describe("creating content", () => {
	test(
		"a Viewer or banned account in Postgres creates nothing, even while SpiceDB still allows it",
		async () => {
			const {
				organizationId,
				actors: [viewer, banned],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
			]);
			await quietly.setRole(organizationId, viewer.user.id, "viewer");
			await quietly.ban(banned.user.id);

			for (const actor of [
				viewer,
				banned,
			])
				expect(await rejection(createBlock(actor, zedToken))).toMatchObject({
					reason: "PERMISSION_DENIED",
				});
		},
		TIMEOUT,
	);
});

describe("adding a chat upload to the Library", () => {
	test(
		"is refused when its owner is a Viewer or banned",
		async () => {
			const {
				organizationId,
				actors: [viewer, banned],
			} = await organizationWith([
				"member",
				"member",
			]);
			const uploads = [];
			for (const actor of [
				viewer,
				banned,
			]) {
				const { asset, zedToken } = await createAsset(actor, organizationId);
				await quietly.makeChatUpload(asset.id);
				uploads.push({
					actor,
					assetId: asset.id,
					zedToken,
				});
			}
			await quietly.setRole(organizationId, viewer.user.id, "viewer");
			await quietly.ban(banned.user.id);

			for (const { actor, assetId, zedToken } of uploads) {
				expect(
					await rejection(addToLibrary(actor, assetId, zedToken)),
				).toMatchObject({
					reason: "PERMISSION_DENIED",
				});
				expect(await originOf(assetId)).toBe("chat");
			}
		},
		TIMEOUT,
	);

	test(
		"queued behind the owner's removal is refused",
		async () => {
			const {
				organizationId,
				actors: [admin, owner],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { asset, zedToken: assetToken } = await createAsset(
				owner,
				organizationId,
			);
			await quietly.makeChatUpload(asset.id);
			const procedures = await run(Procedures);

			await expect(
				queueBehindOrganizationLock(
					organizationId,
					async () =>
						run(
							procedures.organizationMember.delete(
								{
									refs: [
										{
											userId: owner.user.id,
										},
									],
								},
								await procedureOptions(admin, zedToken),
							),
						),
					() => addToLibrary(owner, asset.id, assetToken),
				),
			).rejects.toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await originOf(asset.id)).toBe("chat");
		},
		TIMEOUT,
	);
});
