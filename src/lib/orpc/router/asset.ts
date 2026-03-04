import { and, count, desc, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { dbSchema } from "@/db/schema";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { buildUploadPrefix } from "@/lib/s3/upload-routes";
import { sendDeleteObjectCommand } from "@/lib/s3/utils/commands";
import { deletePrefixRecursively } from "@/lib/s3/utils/file-functions";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import { lookupEntitiesByPermission } from "@/lib/spice-db/client";
import { deletePointsByIdentifier } from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";

export const listAssets = authed.asset.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* lookupEntitiesByPermission({
					userId: context.auth.user.id,
					permission: "read",
					entityType: "asset",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				const whereConditions = [
					inArray(dbSchema.asset.id, allowedIds),
				];

				if (input.filters?.ids) {
					whereConditions.push(inArray(dbSchema.asset.id, input.filters.ids));
				}

				if (input.filters?.search) {
					whereConditions.push(
						ilike(dbSchema.asset.title, `%${input.filters.search}%`),
					);
				}

				return yield* Effect.all(
					[
						db
							.select({
								...getColumns(dbSchema.asset),
							})
							.from(dbSchema.asset)
							.where(and(...whereConditions))
							.orderBy(desc(dbSchema.asset.createdAt))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.asset)
							.where(and(...whereConditions)),
					],
					{
						concurrency: "unbounded",
					},
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
				permission: "read",
				entityType: "asset",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.select({
						...getColumns(dbSchema.asset),
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.id));

				if (!query) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Asset not found",
						}),
					);
				}

				return {
					data: query,
				};
			}),
		),
	);

export const createAsset = authed.asset.create
	.use(requireOrganizationPermission("create_asset"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const assetId = input.id ?? uuidv4();
				const prefix = buildUploadPrefix({
					userId: context.auth.user.id,
					route: "asset",
				});

				const [asset] = yield* db
					.insert(dbSchema.asset)
					.values({
						id: assetId,
						title: input.title ?? "New Asset",
						size: input.size,
						fileType: input.fileType,
						bucket: buckets.main.name,
						prefix,
						userId: context.auth.user.id,
					})
					.returning({
						...getColumns(dbSchema.asset),
					});

				const relationResult = yield* initializeResourceAuthorization({
					resourceType: "asset",
					resourceId: asset.id,
					organizationId: context.auth.session.activeOrganizationId,
					ownerUserId: context.auth.user.id,
				});

				return {
					data: asset,
					meta: {
						zedToken: relationResult.zedToken,
					},
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
				permission: "edit",
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
					.returning({
						...getColumns(dbSchema.asset),
					});

				return {
					data: asset,
				};
			}),
		),
	);

export const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "asset",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (!context.allowedIds || context.allowedIds.length === 0) {
					return {
						success: true,
						message: "No assets to delete",
					};
				}

				const assetsToDelete = yield* db
					.select()
					.from(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				yield* Effect.all(
					assetsToDelete.map((asset) =>
						Effect.gen(function* () {
							const extension = getFileTypeFromMime(asset.fileType);

							yield* sendDeleteObjectCommand({
								bucket: asset.bucket,
								key: `${asset.prefix}/${asset.id}.${extension}`,
							});
							yield* deletePointsByIdentifier({
								assetId: asset.id,
								blockId: undefined,
							});
							yield* deletePrefixRecursively({
								bucket: buckets.processed.name,
								prefix: `${asset.id}/`,
							});
						}),
					),
					{
						concurrency: "unbounded",
					},
				);

				yield* db
					.delete(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				return {
					success: true,
					message: "Assets deleted successfully",
				};
			}),
		),
	);
