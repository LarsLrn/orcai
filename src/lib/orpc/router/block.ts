import { and, countDistinct, desc, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
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

				const whereConditions = [inArray(dbSchema.block.id, allowedIds)];
				if (input.filters?.botId) {
					whereConditions.push(
						eq(dbSchema.botBlock.botId, input.filters.botId),
					);
				}

				return yield* Effect.all(
					[
						db
							.selectDistinctOn([dbSchema.block.id, dbSchema.block.createdAt], {
								...getColumns(dbSchema.block),
							})
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
					.select({ ...getColumns(dbSchema.block) })
					.from(dbSchema.block)
					.where(eq(dbSchema.block.id, input.id))
					.pipe(Effect.map((rows) => rows as Block[]));

				if (!block) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Block not found" }),
					);
				}

				if (block.type === "database") {
					const assets = yield* db
						.select({ assetId: dbSchema.blockAsset.assetId })
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, input.id));

					return { data: block, assets: assets.map((a) => a.assetId) };
				}

				return { data: block };
			}),
		),
	);

export const createBlock = authed.block.create
	.use(requireOrganizationPermission("create_block"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				const [block] = yield* db
					.insert(dbSchema.block)
					.values({
						...input,
						userId: context.auth.user.id,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({ ...getColumns(dbSchema.block) })
					.pipe(Effect.map((rows) => rows as Block[]));

				let zedToken = (yield* initializeResourceAuthorization({
					resourceType: "block",
					resourceId: block.id,
					organizationId: context.auth.session.activeOrganizationId,
					ownerUserId: context.auth.user.id,
				})).zedToken;

				if (input.type === "database") {
					const assets = yield* db
						.insert(dbSchema.blockAsset)
						.values(
							input.assets.map((assetId) => ({
								blockId: block.id,
								assetId,
							})),
						)
						.returning({ assetId: dbSchema.blockAsset.assetId });

					if (input.assets.length > 0) {
						const relationResult = yield* authz.applyRelationshipMutations({
							mutations: input.assets.map((assetId) => ({
								resourceType: "asset" as const,
								resourceId: assetId,
								relation: "block" as const,
								subjectType: "block" as const,
								subjectId: block.id,
								operation: "touch" as const,
							})),
						});
						zedToken = relationResult.zedToken ?? zedToken;
					}

					return {
						data: block,
						assets: assets.map((a) => a.assetId),
						meta: { zedToken },
					};
				}

				return {
					data: block,
					meta: { zedToken },
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
				const authz = yield* AuthzService;

				const [block] = yield* db
					.update(dbSchema.block)
					.set({
						...input,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.block.id, input.id))
					.returning({ ...getColumns(dbSchema.block) })
					.pipe(Effect.map((rows) => rows as Block[]));

				if (input.type === "database" && block.type === "database") {
					const previousAssets = yield* db
						.select({ assetId: dbSchema.blockAsset.assetId })
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, block.id));

					yield* db
						.delete(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, block.id));

					const assets = yield* db
						.insert(dbSchema.blockAsset)
						.values(
							input.assets.map((assetId) => ({
								blockId: block.id,
								assetId,
							})),
						)
						.returning({ assetId: dbSchema.blockAsset.assetId });

					const { removedIds, addedIds } = calculateRelationDelta(
						previousAssets.map((asset) => asset.assetId),
						input.assets,
					);

					if (removedIds.length > 0 || addedIds.length > 0) {
						yield* authz.applyRelationshipMutations({
							mutations: [
								...removedIds.map((assetId) => ({
									resourceType: "asset" as const,
									resourceId: assetId,
									relation: "block" as const,
									subjectType: "block" as const,
									subjectId: block.id,
									operation: "delete" as const,
								})),
								...addedIds.map((assetId) => ({
									resourceType: "asset" as const,
									resourceId: assetId,
									relation: "block" as const,
									subjectType: "block" as const,
									subjectId: block.id,
									operation: "touch" as const,
								})),
							],
						});
					}

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
				permission: "delete",
				entityType: "block",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No blocks to delete" };
				}

				yield* db
					.delete(dbSchema.block)
					.where(inArray(dbSchema.block.id, context.allowedIds));

				return { success: true, message: "Blocks deleted successfully" };
			}),
		),
	);
