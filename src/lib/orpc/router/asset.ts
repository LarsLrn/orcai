import { and, count, desc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	deleteFileFromBucket,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import type { FileType } from "@/lib/s3/schema/file-schema";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";
import { deletePointsByIdentifier } from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";

export const listAssets = authed.asset.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* listAllowedEntities({
					userId: context.auth.user.id,
					action: "read",
					entityType: "asset",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				const whereConditions = [inArray(dbSchema.asset.id, allowedIds)];
				if (input.filters?.ids) {
					whereConditions.push(inArray(dbSchema.asset.id, input.filters.ids));
				}

				return yield* Effect.all(
					[
						db
							.select({ ...getColumns(dbSchema.asset) })
							.from(dbSchema.asset)
							.where(and(...whereConditions))
							.orderBy(desc(dbSchema.asset.createdAt))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({ count: count() })
							.from(dbSchema.asset)
							.where(and(...whereConditions)),
					],
					{ concurrency: "unbounded" },
				).pipe(
					Effect.map(([data, [countResult]]) => ({
						data,
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findAsset = authed.asset.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "asset",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.select({ ...getColumns(dbSchema.asset) })
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.id));

				if (!query) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Asset not found" }),
					);
				}

				return { data: query };
			}),
		),
	);

export const createAsset = authed.asset.create.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [asset] = yield* db
					.insert(dbSchema.asset)
					.values({
						id: input.id, // TODO: This shouldnt come from the client, but needs to match the S3 file ID. Think of a solution to this
						title: input.title ?? "New Asset",
						size: input.size,
						fileType: input.fileType,
						bucket: buckets.main.name,
						prefix: "placeholder", // TODO: Make this dynamic
						userId: context.auth.user.id,
					})
					.returning({ ...getColumns(dbSchema.asset) });

				const relationResult = yield* createRelation({
					entityId: asset.id,
					entityType: "asset",
					userId: context.auth.user.id,
					relation: "owner",
				});

				return {
					data: asset,
					meta: { zedToken: relationResult.zedToken },
				};
			}),
		),
);

export const updateAsset = authed.asset.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "update",
				entityType: "asset",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [asset] = yield* db
					.update(dbSchema.asset)
					.set({
						title: input.title,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.asset.id, input.id))
					.returning({ ...getColumns(dbSchema.asset) });

				return { data: asset };
			}),
		),
	);

export const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "asset",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				// Check if there are any IDs to delete
				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No assets to delete" };
				}

				const assetsToDelete = yield* db
					.select()
					.from(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				yield* Effect.all(
					assetsToDelete.map((asset) =>
						Effect.gen(function* () {
							yield* deleteFileFromBucket({
								bucket: asset.bucket,
								id: asset.id,
								prefix: asset.prefix,
								type: asset.fileType as FileType,
							});
							yield* Effect.promise(() =>
								deletePointsByIdentifier({
									assetId: asset.id,
									blockId: undefined,
								}),
							);
							yield* deletePrefixRecursively({
								bucket: buckets.processed.name,
								prefix: `${asset.id}/`,
							});
						}),
					),
					{ concurrency: "unbounded" },
				);

				yield* db
					.delete(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				return { success: true, message: "Assets deleted successfully" };
			}),
		),
	);
