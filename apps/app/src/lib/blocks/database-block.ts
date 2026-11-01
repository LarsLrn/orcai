import type {
	ActivityRunId,
	AssetId,
	BlockId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	type ObservedLink,
	queueIndexing,
	reconcileLinkPoints,
	replaceIndexing,
} from "@orcai/pg-boss";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { bindUploadRuns } from "@/lib/activity/admission";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { readableIds } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

export const loadDatabaseBlockAssets = (params: {
	blockId: BlockId;
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const assets = yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));
		const capabilities = yield* getManyEntityCapabilities({
			entityType: "asset",
			entityIds: assets.map((asset) => asset.id),
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});

		return assets.map((asset) => ({
			...asset,
			capabilities: capabilities.get(asset.id) ?? emptyCapabilities("asset"),
		}));
	});

/**
 * Fails unless the user can read every asset, since attaching one to a
 * repository passes read on to the repository's audience. An unknown id is
 * refused the same way, so the answer never tells whether it exists.
 */
export const requireReadableAssets = (params: {
	assetIds: readonly AssetId[];
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const assetIds = Array.from(new Set(params.assetIds));
		const readable = yield* readableIds("asset", assetIds, {
			userId: params.userId,
			zedToken: params.zedToken,
		});

		if (assetIds.some((assetId) => !readable.has(assetId))) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "ASSET_LINK_FORBIDDEN",
					message:
						"You do not have access to attach one or more selected assets.",
				}),
			);
		}
	});

/**
 * Replaces a database block's asset links and records the change. Kept links
 * keep their index state; new ones start pending, and those from the user's
 * `uploadRunIds` are indexed as part of their upload. Call it in
 * `writeRelationships`, then pass the result to {@link reindexBlockAssets}.
 */
export const replaceBlockAssets = (params: {
	blockId: BlockId;
	assetIds: readonly AssetId[];
	userId: UserId;
	uploadRunIds: readonly ActivityRunId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const assetIds = Arr.dedupe(params.assetIds);

		const previousAssetIds = (yield* db
			.select({
				assetId: dbSchema.blockAsset.assetId,
			})
			.from(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId))).map(
			(link) => link.assetId,
		);
		const addedIds = Arr.difference(assetIds, previousAssetIds);
		const removedIds = Arr.difference(previousAssetIds, assetIds);

		// Chat uploads stay personal, so only Library assets join a repository.
		const [chatUpload] =
			addedIds.length > 0
				? yield* db
						.select({
							id: dbSchema.asset.id,
						})
						.from(dbSchema.asset)
						.where(
							and(
								inArray(dbSchema.asset.id, addedIds),
								eq(dbSchema.asset.keptIn, "chat"),
							),
						)
						.limit(1)
				: [];
		if (chatUpload)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "CHAT_UPLOAD_NOT_IN_LIBRARY",
					message: "Only Library assets can be linked to a repository.",
				}),
			);

		const link = {
			assetId: dbSchema.blockAsset.assetId,
			blockId: dbSchema.blockAsset.blockId,
			attempt: dbSchema.blockAsset.indexAttempt,
		};
		const removed =
			removedIds.length > 0
				? yield* db
						.delete(dbSchema.blockAsset)
						.where(
							and(
								eq(dbSchema.blockAsset.blockId, params.blockId),
								inArray(dbSchema.blockAsset.assetId, removedIds),
							),
						)
						.returning(link)
				: [];
		yield* replaceIndexing(
			[
				params.blockId,
			],
			removed.map((link) => link.assetId),
		);
		const added =
			addedIds.length > 0
				? yield* db
						.insert(dbSchema.blockAsset)
						.values(
							addedIds.map((assetId) => ({
								blockId: params.blockId,
								assetId,
							})),
						)
						.onConflictDoNothing()
						.returning(link)
				: [];

		yield* recordRelationshipFacts(
			RelationshipFact.BlockAssetsChanged({
				blockId: params.blockId,
				before: previousAssetIds,
				after: assetIds,
			}),
		);

		return {
			added,
			removed,
			runs: yield* bindUploadRuns({
				userId: params.userId,
				runIds: params.uploadRunIds,
				blockId: params.blockId,
				assetIds: added.map((link) => link.assetId),
			}),
		};
	});

/**
 * Reconciles the vectors of unlinked assets, so they go unless a relink owns
 * them, and indexes the newly linked, processed ones, as part of the upload
 * run each was bound to. The rest are indexed once their processing
 * completes.
 */
export const reindexBlockAssets = (params: {
	added: readonly ObservedLink[];
	removed: readonly ObservedLink[];
	runs?: ReadonlyMap<AssetId, ActivityRunId>;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* Effect.forEach(params.removed, reconcileLinkPoints, {
			concurrency: "unbounded",
			discard: true,
		});

		if (params.added.length === 0) return;

		// Locks the rows without a status filter, so processing completing an asset is waited for; a link both queue is admitted once.
		yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const completed = new Set(
						(yield* db
							.select({
								id: dbSchema.asset.id,
								processingStatus: dbSchema.asset.processingStatus,
							})
							.from(dbSchema.asset)
							.where(
								inArray(
									dbSchema.asset.id,
									params.added.map((link) => link.assetId),
								),
							)
							.for("share"))
							.filter((asset) => asset.processingStatus === "completed")
							.map((asset) => asset.id),
					);
					const admissible = params.added.filter((link) =>
						completed.has(link.assetId),
					);
					const runOf = (link: ObservedLink) => params.runs?.get(link.assetId);
					yield* Effect.forEach(
						Arr.dedupe(admissible.map(runOf)),
						(runId) =>
							queueIndexing(
								admissible.filter((link) => runOf(link) === runId),
								runId,
							),
						{
							discard: true,
						},
					);
				}),
			),
		);
	});
