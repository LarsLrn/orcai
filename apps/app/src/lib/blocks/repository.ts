import type {
	ActivityRunId,
	AssetId,
	BlockId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	admit,
	bindUploadRuns,
	type ObservedLink,
	recordDeletion,
	replaceIndexing,
} from "@orcai/preparation";
import type { ReadRevision } from "@orcai/spice-db";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { readableIds } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

export const loadRepositoryAssets = (params: {
	blockId: BlockId;
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken?: ReadRevision;
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
	zedToken?: ReadRevision;
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
 * Replaces a repository's asset links, records the change and admits the
 * indexing of the newly linked, processed assets, as part of the upload run
 * each was bound to; the rest are indexed once their processing completes.
 * Kept links keep their index state. Call it in `writeRelationships`, so the
 * links, their admission and the cleanup of removed links' points commit
 * together, then pass the result to `cleanUpDeletions`.
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

		yield* admitAdded(
			added,
			yield* bindUploadRuns({
				userId: params.userId,
				runIds: params.uploadRunIds,
				blockId: params.blockId,
				assetIds: added.map((link) => link.assetId),
			}),
		);
		return yield* recordDeletion({
			indexedLinks: removed.map(({ assetId, blockId }) => ({
				assetId,
				blockId,
			})),
			files: [],
		});
	});

/**
 * Admits the indexing of the newly linked, processed assets, each as the run
 * it was bound to. Locks the assets without a status filter, so processing
 * completing one is waited for.
 */
const admitAdded = (
	added: readonly ObservedLink[],
	runs: ReadonlyMap<AssetId, ActivityRunId>,
) =>
	Effect.gen(function* () {
		if (added.length === 0) return;
		const db = yield* DB;
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
						added.map((link) => link.assetId),
					),
				)
				.for("share"))
				.filter((asset) => asset.processingStatus === "completed")
				.map((asset) => asset.id),
		);
		const admissible = added.filter((link) => completed.has(link.assetId));
		const runOf = (link: ObservedLink) => runs.get(link.assetId);
		yield* Effect.forEach(
			Arr.dedupe(admissible.map(runOf)),
			(runId) =>
				admit({
					stage: "indexing",
					links: admissible.filter((link) => runOf(link) === runId),
					run: runId
						? {
								id: runId,
							}
						: undefined,
				}),
			{
				discard: true,
			},
		);
	});
