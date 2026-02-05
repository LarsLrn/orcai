import { and, countDistinct, desc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { blockAssetTable, blockTable } from "@/db/schema/block";
import { botBlockTable } from "@/db/schema/bot";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import type { Block } from "@/lib/orpc/schemas/block";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listBlocks = authed.block.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* listAllowedEntities({
					userId: context.auth.user.id,
					action: "read",
					entityType: "block",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				const whereConditions = [inArray(blockTable.id, allowedIds)];
				if (input.filters?.botId) {
					whereConditions.push(eq(botBlockTable.botId, input.filters.botId));
				}

				return yield* Effect.all(
					[
						db
							.selectDistinctOn([blockTable.id, blockTable.createdAt], {
								...getColumns(blockTable),
							})
							.from(blockTable)
							.leftJoin(botBlockTable, eq(botBlockTable.blockId, blockTable.id))
							.where(and(...whereConditions))
							.orderBy(desc(blockTable.createdAt))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: countDistinct(blockTable.id),
							})
							.from(blockTable)
							.leftJoin(botBlockTable, eq(botBlockTable.blockId, blockTable.id))
							.where(and(...whereConditions)),
					],
					{ concurrency: "unbounded" },
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
				action: "read",
				entityType: "block",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = (yield* db
					.select({ ...getColumns(blockTable) })
					.from(blockTable)
					.where(eq(blockTable.id, input.id))) as Block[];

				if (!block) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Block not found" }),
					);
				}

				if (block.type === "database") {
					const assets = yield* db
						.select({ assetId: blockAssetTable.assetId })
						.from(blockAssetTable)
						.where(eq(blockAssetTable.blockId, input.id));

					return { data: block, assets: assets.map((a) => a.assetId) };
				}

				return { data: block };
			}),
		),
	);

export const createBlock = authed.block.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = (yield* db
					.insert(blockTable)
					.values({
						...input,
						userId: context.auth.user.id,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({ ...getColumns(blockTable) })) as Block[];

				const relationResult = yield* createRelation({
					entityId: block.id,
					entityType: "block",
					userId: context.auth.user.id,
					relation: "owner",
				});

				if (input.type === "database") {
					const assets = yield* db
						.insert(blockAssetTable)
						.values(
							input.assets.map((assetId) => ({
								blockId: block.id,
								assetId,
							})),
						)
						.returning({ assetId: blockAssetTable.assetId });

					return {
						data: block,
						assets: assets.map((a) => a.assetId),
						meta: { zedToken: relationResult.zedToken },
					};
				}

				return {
					data: block,
					meta: { zedToken: relationResult.zedToken },
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
				action: "update",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [block] = (yield* db
					.update(blockTable)
					.set({
						...input,
						updatedAt: new Date(),
					})
					.where(eq(blockTable.id, input.id))
					.returning({ ...getColumns(blockTable) })) as Block[];

				if (input.type === "database" && block.type === "database") {
					yield* db
						.delete(blockAssetTable)
						.where(eq(blockAssetTable.blockId, block.id));

					const assets = yield* db
						.insert(blockAssetTable)
						.values(
							input.assets.map((assetId) => ({
								blockId: block.id,
								assetId,
							})),
						)
						.returning({ assetId: blockAssetTable.assetId });

					return { data: block, assets: assets.map((a) => a.assetId) };
				}

				return { data: block };
			}),
		),
	);

export const deleteBlocks = authed.block.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "block",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				// Check if there are any IDs to delete
				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No blocks to delete" };
				}

				yield* db
					.delete(blockTable)
					.where(inArray(blockTable.id, context.allowedIds));

				return { success: true, message: "Blocks deleted successfully" };
			}),
		),
	);
