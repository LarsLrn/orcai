import { DB, dbSchema } from "@orcai/db";
import type { Block, ResourceOwner } from "@orcai/schema";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { readableIds, requireReadable } from "@/lib/authz/content-access";
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
	repositoryTotals,
	retryDocument,
	retryFailedDocuments,
} from "@/lib/blocks/readiness";
import * as AppErrors from "@/lib/effect/utils/errors";
import { libraryAccess } from "@/lib/library/library-access";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";
import { literalSearch } from "@/lib/utils/literal-search";

const blockOrder = {
	newest: [
		desc(dbSchema.block.createdAt),
		desc(dbSchema.block.id),
	],
	name: [
		asc(dbSchema.block.name),
		asc(dbSchema.block.id),
	],
};

const listBlocks = authed.block.list.effect(function* ({ input, context }) {
	const db = yield* DB;

	const botId = input.filters?.botId;
	const status = input.filters?.status ?? "ready";
	const reader = {
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		zedToken: getZedToken(context, input),
	};

	// A bot's blocks are its contents, readable with it; the rest is the library.
	const visible = botId
		? and(
				(yield* readableIds(
					"bot",
					[
						botId,
					],
					reader,
				)).has(botId)
					? inArray(
							dbSchema.block.id,
							db
								.select({
									blockId: dbSchema.botBlock.blockId,
								})
								.from(dbSchema.botBlock)
								.where(eq(dbSchema.botBlock.botId, botId)),
						)
					: sql`false`,
				status === "all" ? undefined : eq(dbSchema.block.status, status),
			)
		: yield* (yield* libraryAccess(reader)).condition("block", {
				scope: input.filters?.scope,
				status,
			});
	const where = and(
		visible,
		input.filters?.type
			? eq(dbSchema.block.type, input.filters.type)
			: undefined,
		input.filters?.search
			? ilike(dbSchema.block.name, literalSearch(input.filters.search))
			: undefined,
	);

	const [rows, [counted]] = yield* Effect.all(
		[
			db
				.select({
					...getColumns(dbSchema.block),
					owner: ownerColumns,
				})
				.from(dbSchema.block)
				.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.block.userId))
				.where(where)
				.orderBy(...blockOrder[input.sort])
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({
					count: count(),
				})
				.from(dbSchema.block)
				.where(where),
		],
		{
			concurrency: "unbounded",
		},
	);

	const blocks = rows as (Block & {
		owner: ResourceOwner;
	})[];
	const [capabilities, totals] = yield* Effect.all(
		[
			getManyEntityCapabilities({
				entityType: "block",
				entityIds: blocks.map((block) => block.id),
				userId: reader.userId,
				organizationId: reader.organizationId,
				zedToken: reader.zedToken,
			}),
			repositoryTotals(
				blocks
					.filter((block) => block.type === "database")
					.map((block) => block.id),
			),
		],
		{
			concurrency: "unbounded",
		},
	);

	return {
		data: blocks.map((block) => ({
			...block,
			capabilities: capabilities.get(block.id) ?? emptyCapabilities("block"),
			documents: block.type === "database" ? totals(block.id) : null,
		})),
		rowCount: counted.count,
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
		yield* requireReadable("block", input.id, {
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		const [block] = yield* db
			.select({
				...getColumns(dbSchema.block),
				owner: ownerColumns,
			})
			.from(dbSchema.block)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.block.userId))
			.where(eq(dbSchema.block.id, input.id))
			.pipe(
				Effect.map(
					(rows) =>
						rows as (Block & {
							owner: ResourceOwner;
						})[],
				),
			);

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
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: getZedToken(context, input),
		});

		if (block.type === "database") {
			const assets = yield* loadDatabaseBlockAssets({
				blockId: input.id,
				userId: context.auth.user.id,
				organizationId: context.auth.session.activeOrganizationId,
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
		const allowedIds = context.allowedIds ?? [];

		if (allowedIds.length === 0) {
			return {
				success: true,
				message: "No blocks to delete",
			};
		}

		yield* deleteResourcesWithAuthorization({
			resourceType: "block",
			resourceIds: allowedIds,
		});

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
			organizationId: context.auth.session.activeOrganizationId,
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
