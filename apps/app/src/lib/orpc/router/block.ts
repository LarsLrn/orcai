import { DB, dbSchema } from "@orcai/db";
import type { Block } from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	hasPermission,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import { and, countDistinct, desc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import {
	loadDatabaseBlockAssets,
	syncDatabaseBlockAssets,
} from "@/lib/orpc/router/helpers/database-block";

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
					eq(dbSchema.block.status, input.filters?.status ?? "ready"),
				];
				if (input.filters?.botId) {
					whereConditions.push(
						eq(dbSchema.botBlock.botId, input.filters.botId),
					);
				}
				if (input.filters?.type) {
					whereConditions.push(eq(dbSchema.block.type, input.filters.type));
				}

				const [rawBlocks, [countResult]] = yield* Effect.all(
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
				);

				const blocks = rawBlocks as Block[];
				const editableBlockIds = new Set<string>();

				if (blocks.length > 0) {
					const permissions = yield* checkManyEntityPermissions({
						entityIds: blocks.map((block) => block.id),
						entityType: "block",
						permission: "edit",
						userId: context.auth.user.id,
						zedToken: input.zedToken,
					});

					for (const pair of permissions.pairs) {
						const blockId = pair.request?.resource?.objectId;
						const allowed =
							pair.response.oneofKind === "item" &&
							hasPermission({
								permissionship: pair.response.item.permissionship,
							});

						if (blockId && allowed) {
							editableBlockIds.add(blockId);
						}
					}
				}

				return {
					data: blocks.map((block) => ({
						...block,
						canEdit: editableBlockIds.has(block.id),
					})),
					rowCount: countResult.count,
				};
			}),
		),
);

export const findBlock = authed.block.find
	.use(
		...requireEntityPermission("block", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.handler(async ({ input, context, errors }) =>
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

				const canEditPermission = yield* checkEntityPermission({
					entityId: input.id,
					entityType: "block",
					permission: "edit",
					userId: context.auth.user.id,
					zedToken: input.zedToken,
				});
				const canEdit = hasPermission(canEditPermission);

				if (block.type === "database") {
					const assets = yield* loadDatabaseBlockAssets({
						blockId: input.id,
					});

					return {
						data: {
							...block,
							canEdit,
						},
						assets,
					};
				}

				return {
					data: {
						...block,
						canEdit,
					},
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
		...requireEntityPermission("block", "edit", {
			entityId: "id",
		}),
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (input.status === "draft") {
					const linkedReadyBots = yield* db
						.select({
							id: dbSchema.bot.id,
							name: dbSchema.bot.name,
						})
						.from(dbSchema.botBlock)
						.innerJoin(
							dbSchema.bot,
							eq(dbSchema.bot.id, dbSchema.botBlock.botId),
						)
						.where(
							and(
								eq(dbSchema.botBlock.blockId, input.id),
								eq(dbSchema.bot.status, "ready"),
							),
						)
						.limit(5);

					if (linkedReadyBots.length > 0) {
						const names = linkedReadyBots
							.map((bot) => `"${bot.name}"`)
							.join(", ");
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: `Cannot move this block to draft because it is used by ready bot(s): ${names}.`,
							}),
						);
					}
				}

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
		checkManyPermissionMiddleware("block"),
		(input): CheckManyPermissionInputFor<"block"> => ({
			entityIds: input.refs.map((ref) => ref.id),
			permission: "delete",
		}),
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
