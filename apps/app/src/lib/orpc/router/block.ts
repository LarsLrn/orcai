import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Block } from "@orcai/schema";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import {
	and,
	countDistinct,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
} from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/authz/entity-capabilities";
import { writeRelationships } from "@/lib/authz/relationship-write";
import {
	deleteResourcesWithAuthorization,
	initializeResourceAuthorization,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	loadDatabaseBlockAssets,
	reindexBlockAssets,
	replaceBlockAssets,
	requireReadableAssets,
} from "@/lib/blocks/database-block";
import {
	loadRepositoryReadiness,
	retryDocument,
	retryFailedDocuments,
} from "@/lib/blocks/readiness";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "@/lib/utils/literal-search";

const listBlocks = authed.block.list.effect(function* ({ input, context }) {
	const db = yield* DB;

	const allowedIds = yield* lookupEntitiesByPermission({
		userId: context.auth.user.id,
		permission: "read",
		entityType: "block",
		zedToken: getZedToken(context, input),
	});

	const whereConditions = [
		inArray(dbSchema.block.id, allowedIds),
		eq(dbSchema.block.status, input.filters?.status ?? "ready"),
	];
	if (input.filters?.botId) {
		whereConditions.push(eq(dbSchema.botBlock.botId, input.filters.botId));
	}
	if (input.filters?.type) {
		whereConditions.push(eq(dbSchema.block.type, input.filters.type));
	}
	if (input.filters?.search) {
		whereConditions.push(
			ilike(dbSchema.block.name, literalSearch(input.filters.search)),
		);
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
				.orderBy(desc(dbSchema.block.createdAt), desc(dbSchema.block.id))
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
	const capabilities = yield* getManyEntityCapabilities({
		entityType: "block",
		entityIds: blocks.map((block) => block.id),
		userId: context.auth.user.id,
		zedToken: getZedToken(context, input),
	});

	return {
		data: blocks.map((block) => ({
			...block,
			capabilities: capabilities.get(block.id) ?? emptyCapabilities("block"),
		})),
		rowCount: countResult.count,
	};
});

const findBlock = authed.block.find
	.use(
		requireEntityPermission("block", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
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
				new AppErrors.NotFoundError({
					reason: "BLOCK_NOT_FOUND",
					message: "Block not found",
				}),
			);
		}

		const capabilities = yield* getEntityCapabilities({
			entityType: "block",
			entityId: input.id,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		if (block.type === "database") {
			const assets = yield* loadDatabaseBlockAssets({
				blockId: input.id,
				userId: context.auth.user.id,
				zedToken: getZedToken(context, input),
			});

			return {
				data: {
					...block,
					capabilities,
				},
				assets,
			};
		}

		return {
			data: {
				...block,
				capabilities,
			},
		};
	});

const createBlock = authed.block.create
	.use(requireOrganizationPermission("create_block"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		if (input.type === "database") {
			yield* requireReadableAssets({
				assetIds: input.assets,
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			});
		}

		const organizationId = context.auth.session.activeOrganizationId;
		const {
			result: { block, links },
		} = yield* writeRelationships(
			{
				organizationIds: [
					organizationId,
				],
			},
			Effect.gen(function* () {
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

				yield* initializeResourceAuthorization({
					resource: {
						resourceType: "block",
						resourceId: block.id,
					},
					organizationId,
					ownerUserId: context.auth.user.id,
				});

				return {
					block,
					links:
						input.type === "database"
							? yield* replaceBlockAssets({
									blockId: block.id,
									assetIds: input.assets,
								})
							: undefined,
				};
			}),
		);

		if (input.type === "database" && links) {
			yield* reindexBlockAssets(links);

			return {
				data: block,
				assets: input.assets,
			};
		}

		return {
			data: block,
		};
	});

const updateBlock = authed.block.update
	.use(
		requireEntityPermission("block", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const previousAssetIds =
			input.type === "database"
				? (yield* db
						.select({
							assetId: dbSchema.blockAsset.assetId,
						})
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, input.id))).map(
						(asset) => asset.assetId,
					)
				: [];

		if (input.type === "database") {
			yield* requireReadableAssets({
				assetIds: input.assets.filter(
					(assetId) => !previousAssetIds.includes(assetId),
				),
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			});
		}

		const organizationIds = yield* resourceOrganizations([
			{
				resourceType: "block",
				resourceId: input.id,
			},
		]);
		const {
			result: { block, links },
		} = yield* writeRelationships(
			{
				organizationIds,
			},
			Effect.gen(function* () {
				// Checked under the organization write lock, so a concurrent status change cannot interleave.
				const [current] = yield* db
					.select({
						status: dbSchema.block.status,
					})
					.from(dbSchema.block)
					.where(eq(dbSchema.block.id, input.id))
					.for("update");

				if (current?.status === "ready" && input.status === "draft") {
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
						const botNames = linkedReadyBots.map((bot) => bot.name);
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "BLOCK_IN_USE_BY_READY_BOTS",
								params: {
									botNames,
								},
								message: `Cannot move this block to draft because it is used by ready bot(s): ${botNames.join(", ")}.`,
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

				return {
					block,
					links:
						input.type === "database" && block.type === "database"
							? yield* replaceBlockAssets({
									blockId: block.id,
									assetIds: input.assets,
								})
							: undefined,
				};
			}),
		);

		if (input.type === "database" && links) {
			yield* reindexBlockAssets(links);

			return {
				data: block,
				assets: input.assets,
			};
		}

		return {
			data: block,
		};
	});

const deleteBlocks = authed.block.delete
	.use(
		checkManyPermissionMiddleware("block").adaptInput(
			(input): CheckManyPermissionInputFor<"block"> => ({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
			}),
		),
	)
	.effect(function* ({ context }) {
		const db = yield* DB;

		const allowedIds = context.allowedIds ?? [];

		if (allowedIds.length === 0) {
			return {
				success: true,
				message: "No blocks to delete",
			};
		}

		const linkedAssets = yield* db
			.select({
				blockId: dbSchema.blockAsset.blockId,
				assetId: dbSchema.blockAsset.assetId,
			})
			.from(dbSchema.blockAsset)
			.where(inArray(dbSchema.blockAsset.blockId, allowedIds));

		yield* deleteResourcesWithAuthorization({
			resourceType: "block",
			resourceIds: allowedIds,
		});

		yield* Effect.forEach(
			Object.entries(Arr.groupBy(linkedAssets, (link) => link.blockId)),
			([blockId, links]) =>
				reindexBlockAssets({
					blockId: blockId as BlockId,
					addedIds: [],
					removedIds: links.map((link) => link.assetId),
				}),
			{
				concurrency: "unbounded",
				discard: true,
			},
		);

		return {
			success: true,
			message: "Blocks deleted successfully",
		};
	});

const blockReadiness = authed.block.readiness.effect(function* ({
	input,
	context,
}) {
	return {
		data: yield* loadRepositoryReadiness({
			blockIds: input.blockIds,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		}),
	};
});

const retryBlockDocument = authed.block.retryDocument
	.use(
		requireEntityPermission("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input }) {
		return yield* retryDocument(input);
	});

const retryFailedBlockDocuments = authed.block.retryFailed
	.use(
		requireEntityPermission("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input }) {
		return yield* retryFailedDocuments(input);
	});

export const blockRouter = {
	list: listBlocks,
	create: createBlock,
	find: findBlock,
	update: updateBlock,
	delete: deleteBlocks,
	readiness: blockReadiness,
	retryDocument: retryBlockDocument,
	retryFailed: retryFailedBlockDocuments,
};
