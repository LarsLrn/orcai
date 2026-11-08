import {
	type AssetId,
	buckets,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	buildStoredExtractionKey,
	createImageOnlyExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import { assetObjectKey } from "@orcai/s3";
import { sendPutObjectCommand } from "@orcai/s3/server";
import { writeRelationshipMutations } from "@orcai/spice-db";
import { createOrganization, createUser } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

// A 1x1 PNG.
export const PIXEL =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Users and private assets for chat attachments, written through `run`, which provides the stack's DB, SpiceDB and S3. */
export const assetFixtures = (
	run: <A, E, R>(effect: Effect.Effect<A, E, R>) => Promise<A>,
) => {
	const newUser = () => run(createUser().pipe(Effect.map((user) => user.id)));

	/** Writes the tuple, and for a viewer the grant row reads are checked against too. */
	const relate = (
		assetId: AssetId,
		relation: "owner" | "viewer",
		userId: UserId,
		operation: "create" | "delete" = "create",
	) =>
		run(
			Effect.gen(function* () {
				if (relation === "viewer") {
					const db = yield* DB;
					if (operation === "create") {
						const { organization } = yield* createOrganization();
						yield* db.insert(dbSchema.resourceGrant).values({
							resourceType: "asset",
							resourceId: assetId,
							principalType: "user",
							principalId: userId,
							role: "viewer",
							organizationId: organization.id as OrganizationId,
							grantedBy: userId,
						});
					} else {
						yield* db
							.update(dbSchema.resourceGrant)
							.set({
								revokedAt: new Date(),
							})
							.where(
								and(
									eq(dbSchema.resourceGrant.resourceId, assetId),
									eq(dbSchema.resourceGrant.principalId, userId),
								),
							);
					}
				}
				return yield* writeRelationshipMutations([
					{
						resourceType: "asset",
						resourceId: assetId,
						relation,
						subjectType: "user",
						subjectId: userId,
						operation,
					},
				]);
			}),
		);

	/** An image asset only its owner can read, and the token of that write. */
	const privateImage = async (
		owner: UserId,
		{
			title = "Floor plan",
			size = 70,
		}: {
			title?: string;
			size?: number;
		} = {},
	) => {
		const asset = await run(
			Effect.gen(function* () {
				const [row] = yield* (yield* DB)
					.insert(dbSchema.asset)
					.values({
						bucket: buckets.main.name,
						prefix: `users/${owner}/chatAttachment/2026/10`,
						title,
						fileType: "png",
						size,
						userId: owner,
					})
					.returning();
				yield* sendPutObjectCommand({
					bucket: row.bucket,
					key: assetObjectKey(row),
					body: Buffer.from(PIXEL, "base64"),
					contentType: "image/png",
				});
				return row;
			}),
		);
		const { zedToken } = await relate(asset.id, "owner", owner);
		return {
			asset,
			zedToken,
		};
	};

	/** PDF assets only their owner can read, each with its `content` as its stored extraction, and the token of the write. */
	const privateAssets = (
		owner: UserId,
		files: readonly {
			title: string;
			content: string;
		}[],
	) =>
		run(
			Effect.gen(function* () {
				const ids = files.map(() => crypto.randomUUID() as AssetId);
				const rows = yield* (yield* DB)
					.insert(dbSchema.asset)
					.values(
						files.map(({ title, content }, index) => ({
							id: ids[index],
							bucket: buckets.main.name,
							prefix: `users/${owner}/chatAttachment/2026/10`,
							title,
							fileType: "pdf" as const,
							size: content.length,
							userId: owner,
						})),
					)
					.returning();
				const assets = ids.map(
					(id) => rows.find((row) => row.id === id) as (typeof rows)[number],
				);
				yield* Effect.forEach(
					assets,
					(asset, index) =>
						sendPutObjectCommand({
							bucket: buckets.processed.name,
							key: buildStoredExtractionKey(asset.id),
							body: Buffer.from(
								serializeStoredExtractionArtifact({
									...createImageOnlyExtractionArtifact({
										mimeType: "application/pdf",
										format: "pdf",
										sourceBucket: asset.bucket,
										sourcePath: asset.prefix,
									}),
									content: files[index].content,
									images: [],
								}),
							),
							contentType: "application/json",
						}),
					{
						concurrency: "unbounded",
						discard: true,
					},
				);
				const { zedToken } = yield* writeRelationshipMutations(
					assets.map((asset) => ({
						resourceType: "asset",
						resourceId: asset.id,
						relation: "owner",
						subjectType: "user",
						subjectId: owner,
						operation: "create",
					})),
				);
				return {
					assets,
					zedToken,
				};
			}),
		);

	return {
		newUser,
		relate,
		privateImage,
		privateAssets,
	};
};
