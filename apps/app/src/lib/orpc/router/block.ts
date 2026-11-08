import { DB, dbSchema, ownerColumns } from "@orcai/db";
import {
	cleanUpDeletions,
	prepareRepositoryAssetAgain,
	prepareRepositoryFailedAgain,
} from "@orcai/preparation";
import type { Block, ResourceOwner } from "@orcai/schema";
import { eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { prepareAgainError } from "@/lib/assets/prepare-again";
import { getEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { writeRelationships } from "@/lib/authz/relationship-write";
import {
	deleteResourcesWithAuthorization,
	initializeResourceAuthorization,
	writePermitted,
} from "@/lib/authz/resource-lifecycle";
import { readRevision } from "@/lib/authz/zed-token";
import { listBlockTiles } from "@/lib/blocks/block-list";
import { loadRepositoryReadiness } from "@/lib/blocks/readiness";
import {
	loadRepositoryAssets,
	replaceBlockAssets,
	requireReadableAssets,
} from "@/lib/blocks/repository";
import { draftingUnreadyBots } from "@/lib/bots/bot-readiness";
import * as AppErrors from "@/lib/effect/utils/errors";
import { libraryAccess } from "@/lib/library/library-access";
import { homeOrganizations } from "@/lib/library/tile-details";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import { requireEntityAccess } from "@/lib/orpc/middlewares/permission";

const listBlocks = authed.block.list
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const reader = {
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: readRevision(context, input),
		};
		return yield* listBlockTiles({
			input,
			reader,
			access: yield* libraryAccess(reader),
		});
	});

const findBlock = authed.block.find
	.use(requireOrganization())
	.use(
		requireEntityAccess("block", "read", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

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

		const [capabilities, homes] = yield* Effect.all(
			[
				getEntityCapabilities({
					entityType: "block",
					entityId: input.id,
					userId: context.auth.user.id,
					organizationId: context.auth.session.activeOrganizationId,
					zedToken: readRevision(context, input),
				}),
				homeOrganizations(
					"block",
					[
						input.id,
					],
					context.auth.session.activeOrganizationId,
				),
			],
			{
				concurrency: "unbounded",
			},
		);
		const found = {
			...block,
			capabilities,
			homeOrganization: homes(block.id),
		};

		if (block.type === "repository") {
			const assets = yield* loadRepositoryAssets({
				blockId: input.id,
				userId: context.auth.user.id,
				organizationId: context.auth.session.activeOrganizationId,
				zedToken: readRevision(context, input),
			});

			return {
				data: found,
				assets,
			};
		}

		return {
			data: found,
		};
	});

const createBlock = authed.block.create
	.use(requireOrganization("create_block"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		if (input.type === "repository") {
			yield* requireReadableAssets({
				assetIds: input.assets,
				userId: context.auth.user.id,
				zedToken: readRevision(context),
			});
		}

		const organizationId = context.auth.session.activeOrganizationId;
		const {
			result: { block, cleanup },
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
					cleanup:
						input.type === "repository"
							? yield* replaceBlockAssets({
									blockId: block.id,
									assetIds: input.assets,
									userId: context.auth.user.id,
									uploadRunIds: input.uploadRunIds,
								})
							: undefined,
				};
			}),
		);

		if (input.type === "repository") {
			yield* cleanUpDeletions([
				cleanup,
			]);

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
		requireEntityAccess("block", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const previousAssetIds =
			input.type === "repository"
				? (yield* db
						.select({
							assetId: dbSchema.blockAsset.assetId,
						})
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.blockId, input.id))).map(
						(asset) => asset.assetId,
					)
				: [];

		if (input.type === "repository") {
			yield* requireReadableAssets({
				assetIds: input.assets.filter(
					(assetId) => !previousAssetIds.includes(assetId),
				),
				userId: context.auth.user.id,
				zedToken: readRevision(context),
			});
		}

		const actor = {
			userId: context.auth.user.id,
			zedToken: readRevision(context, input),
		};
		const {
			result: { block, cleanup },
		} = yield* writePermitted(
			{
				resourceType: "block",
				resourceIds: [
					input.id,
				],
				permission: "edit",
				actor,
			},
			draftingUnreadyBots(
				{
					blockIds: [
						input.id,
					],
				},
				Effect.gen(function* () {
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
						cleanup:
							input.type === "repository" && block.type === "repository"
								? yield* replaceBlockAssets({
										blockId: block.id,
										assetIds: input.assets,
										userId: context.auth.user.id,
										uploadRunIds: input.uploadRunIds,
									})
								: undefined,
					};
				}),
			),
		);

		if (input.type === "repository" && block.type === "repository") {
			yield* cleanUpDeletions([
				cleanup,
			]);

			return {
				data: block,
				assets: input.assets,
			};
		}

		return {
			data: block,
		};
	});

const deleteBlocks = authed.block.delete.effect(function* ({ input, context }) {
	yield* deleteResourcesWithAuthorization({
		resourceType: "block",
		resourceIds: input.refs.map((ref) => ref.id),
		actor: {
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		},
	});

	return {
		success: true,
		message: "Blocks deleted successfully",
	};
});

const blockReadiness = authed.block.readiness
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		return {
			data: yield* loadRepositoryReadiness({
				blockIds: input.blockIds,
				userId: context.auth.user.id,
				organizationId: context.auth.session.activeOrganizationId,
				zedToken: readRevision(context, input),
			}),
		};
	});

const prepareAssetAgainProcedure = authed.block.prepareAssetAgain
	.use(
		requireEntityAccess("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input, context }) {
		const { result } = yield* writePermitted(
			{
				resourceType: "block",
				resourceIds: [
					input.blockId,
				],
				permission: "edit",
				actor: {
					userId: context.auth.user.id,
					zedToken: readRevision(context, input),
				},
			},
			prepareRepositoryAssetAgain({
				...input,
				userId: context.auth.user.id,
			}),
		).pipe(
			Effect.catchTag("PrepareAgainRefused", (refused) =>
				Effect.fail(prepareAgainError(refused)),
			),
		);
		return result;
	});

const prepareFailedAgainProcedure = authed.block.prepareFailedAgain
	.use(
		requireEntityAccess("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input, context }) {
		const { result } = yield* writePermitted(
			{
				resourceType: "block",
				resourceIds: [
					input.blockId,
				],
				permission: "edit",
				actor: {
					userId: context.auth.user.id,
					zedToken: readRevision(context, input),
				},
			},
			prepareRepositoryFailedAgain({
				...input,
				userId: context.auth.user.id,
			}),
		);
		return result;
	});

export const blockRouter = {
	list: listBlocks,
	create: createBlock,
	find: findBlock,
	update: updateBlock,
	delete: deleteBlocks,
	readiness: blockReadiness,
	prepareAssetAgain: prepareAssetAgainProcedure,
	prepareFailedAgain: prepareFailedAgainProcedure,
};
