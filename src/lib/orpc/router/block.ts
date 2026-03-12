import { and, countDistinct, desc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
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
import {
	loadDatabaseBlockAttachments,
	syncDatabaseBlockAssets,
} from "@/lib/orpc/router/helpers/database-block";
import type { Block } from "@/lib/orpc/schemas/block";
import { lookupEntitiesByPermission } from "@/lib/spice-db/client";

export const listBlocks = authed.block.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* lookupEntitiesByPermission({
					userId: context.auth.user.id,
					permission: "read",
					entityType: "block",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				const whereConditions = [
					inArray(dbSchema.block.id, allowedIds),
					eq(dbSchema.block.status, "ready"),
				];
				if (input.filters?.botId) {
					whereConditions.push(
						eq(dbSchema.botBlock.botId, input.filters.botId),
					);
				}

				return yield* Effect.all(
					[
						db
							.selectDistinctOn(
								[
									dbSchema.block.id,
									dbSchema.block.createdAt,
								],
								{
									...getColumns(dbSchema.block),
								},
							)
							.from(dbSchema.block)
							.leftJoin(
								dbSchema.botBlock,
								eq(dbSchema.botBlock.blockId, dbSchema.block.id),
							)
							.where(and(...whereConditions))
							.orderBy(desc(dbSchema.block.createdAt))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: countDistinct(dbSchema.block.id),
							})
							.from(dbSchema.block)
							.leftJoin(
								dbSchema.botBlock,
								eq(dbSchema.botBlock.blockId, dbSchema.block.id),
							)
							.where(and(...whereConditions)),
					],
					{
						concurrency: "unbounded",
					},
				).pipe(
					Effect.map(([data, [countResult]]) => ({
						data: data as Block[],
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findBlock = authed.block.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "block",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = yield* db
					.select({
						...getColumns(dbSchema.block),
					})
					.from(dbSchema.block)
					.where(eq(dbSchema.block.id, input.id))
					.pipe(Effect.map((rows) => rows as Block[]));

				if (!block) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Block not found",
						}),
					);
				}

				if (block.type === "database") {
					const attachments = yield* loadDatabaseBlockAttachments({
						blockId: input.id,
					});

					return {
						data: block,
						assets: attachments,
					};
				}

				return {
					data: block,
				};
			}),
		),
	);

export const createBlock = authed.block.create
	.use(requireOrganizationPermission("create_block"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = yield* db
					.insert(dbSchema.block)
					.values({
						...input,
						userId: context.auth.user.id,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({
						...getColumns(dbSchema.block),
					})
					.pipe(Effect.map((rows) => rows as Block[]));

				const zedToken = (yield* initializeResourceAuthorization({
					resourceType: "block",
					resourceId: block.id,
					organizationId: context.auth.session.activeOrganizationId,
					ownerUserId: context.auth.user.id,
				})).zedToken;

				if (input.type === "database") {
					const syncResult = yield* syncDatabaseBlockAssets({
						blockId: block.id,
						assetIds: input.assets,
						previousAssetIds: [],
					});

					return {
						data: block,
						assets: syncResult.assetIds,
						meta: {
							zedToken,
						},
					};
				}

				return {
					data: block,
					meta: {
						zedToken,
					},
				};
			}),
		),
	);

export const updateBlock = authed.block.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = yield* db
					.update(dbSchema.block)
					.set({
						...input,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.block.id, input.id))
					.returning({
						...getColumns(dbSchema.block),
					})
					.pipe(Effect.map((rows) => rows as Block[]));

				if (input.type === "database" && block.type === "database") {
					const previousAssets = yield* db
						.select({
							assetId: dbSchema.blockAsset.assetId,
						})
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, block.id));

					const syncResult = yield* syncDatabaseBlockAssets({
						blockId: block.id,
						assetIds: input.assets,
						previousAssetIds: previousAssets.map((asset) => asset.assetId),
					});

					return {
						data: block,
						assets: syncResult.assetIds,
					};
				}

				return {
					data: block,
				};
			}),
		),
	);

export const deleteBlocks = authed.block.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "block",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (!context.allowedIds || context.allowedIds.length === 0) {
					return {
						success: true,
						message: "No blocks to delete",
					};
				}

				const databaseBlocks = yield* db
					.select({
						id: dbSchema.block.id,
					})
					.from(dbSchema.block)
					.where(
						and(
							inArray(dbSchema.block.id, context.allowedIds),
							eq(dbSchema.block.type, "database"),
						),
					);

				yield* Effect.forEach(
					databaseBlocks,
					(block) =>
						syncDatabaseBlockAssets({
							blockId: block.id,
							assetIds: [],
						}),
					{
						concurrency: "unbounded",
						discard: true,
					},
				);

				yield* db
					.delete(dbSchema.block)
					.where(inArray(dbSchema.block.id, context.allowedIds));

				return {
					success: true,
					message: "Blocks deleted successfully",
				};
			}),
		),
	);
