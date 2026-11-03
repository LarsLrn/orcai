import type { AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema, homeOrganization } from "@orcai/db";
import { and, eq, inArray } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { admit } from "./admission";
import { againStage, assetState, type PrepareAgainRefusal } from "./readiness";
import { inActivityRun } from "./runs";

/** A person's request to prepare an asset again admitted nothing. */
export class PrepareAgainRefused extends Data.TaggedError(
	"PrepareAgainRefused",
)<{
	readonly reason: "not_found" | "not_attached" | PrepareAgainRefusal;
}> {}

const refuse = (reason: PrepareAgainRefused["reason"]) =>
	Effect.fail(
		new PrepareAgainRefused({
			reason,
		}),
	);

const assetColumns = {
	id: dbSchema.asset.id,
	generation: dbSchema.asset.processingGeneration,
	fileType: dbSchema.asset.fileType,
	processingStatus: dbSchema.asset.processingStatus,
	processingFailure: dbSchema.asset.processingFailure,
};

/** A processing generation may start again from these. */
const PREPARED = [
	"completed",
	"failed",
] as const;

/**
 * Prepares the file again, as a retry run of the user's in its organisation,
 * when the one rule lets it.
 */
export const prepareAssetAgain = (params: {
	userId: UserId;
	assetId: AssetId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [asset] = yield* db
			.select(assetColumns)
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, params.assetId));
		if (!asset) return yield* refuse("not_found");
		const stage = againStage(asset);
		if (stage !== "processing" && stage !== "indexing") {
			return yield* refuse(stage);
		}

		const admitted = yield* inActivityRun(
			{
				userId: params.userId,
				kind: "retry",
				organizationId: homeOrganization("asset", asset.id),
			},
			(runId) =>
				admit({
					stage: "processing",
					assets: [
						asset,
					],
					from: PREPARED,
					run: {
						id: runId,
					},
				}),
		);
		// Another request admitted it since the asset was read.
		if (admitted.length === 0) return yield* refuse("preparing");
	});

/** The repository's assets with their links, optionally only some. */
const linkedAssets = (params: {
	blockId: BlockId;
	assetIds?: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset, blockAsset } = dbSchema;
		return yield* db
			.select({
				...assetColumns,
				indexStatus: blockAsset.indexStatus,
				indexFailure: blockAsset.indexFailure,
				attempt: blockAsset.indexAttempt,
			})
			.from(blockAsset)
			.innerJoin(asset, eq(asset.id, blockAsset.assetId))
			.where(
				and(
					eq(blockAsset.blockId, params.blockId),
					params.assetIds
						? inArray(blockAsset.assetId, [
								...params.assetIds,
							])
						: undefined,
				),
			);
	});

type LinkedAsset = Effect.Success<ReturnType<typeof linkedAssets>>[number];

const stageOf = (row: LinkedAsset) => againStage(row, row);

/** Runs the assets' stages again as one retry run of the user's in the repository. */
const runAgain = (params: {
	userId: UserId;
	blockId: BlockId;
	assets: readonly LinkedAsset[];
}) =>
	inActivityRun(
		{
			userId: params.userId,
			kind: "retry",
			organizationId: homeOrganization("block", params.blockId),
			blockId: params.blockId,
		},
		(runId) =>
			Effect.gen(function* () {
				const run = {
					id: runId,
					blockId: params.blockId,
				};
				const processing = yield* admit({
					stage: "processing",
					assets: params.assets.filter(
						(asset) => stageOf(asset) === "processing",
					),
					from: PREPARED,
					run,
				});
				const indexing = yield* admit({
					stage: "indexing",
					links: params.assets
						.filter((asset) => stageOf(asset) === "indexing")
						.map((asset) => ({
							assetId: asset.id,
							blockId: params.blockId,
							attempt: asset.attempt,
						})),
					run,
				});
				return {
					processing: processing.length,
					indexing: indexing.length,
				};
			}),
	);

/**
 * Runs one asset's stage in the repository again, as the one rule picks it:
 * processing when the file failed or its stored extraction is missing,
 * otherwise indexing in this repository.
 */
export const prepareRepositoryAssetAgain = (params: {
	userId: UserId;
	blockId: BlockId;
	assetId: AssetId;
}) =>
	Effect.gen(function* () {
		const [asset] = yield* linkedAssets({
			blockId: params.blockId,
			assetIds: [
				params.assetId,
			],
		});
		if (!asset) return yield* refuse("not_attached");
		const stage = stageOf(asset);
		if (stage !== "processing" && stage !== "indexing") {
			return yield* refuse(stage);
		}

		const retried = yield* runAgain({
			userId: params.userId,
			blockId: params.blockId,
			assets: [
				asset,
			],
		});
		// Another request admitted the stage since the asset was read.
		if (retried[stage] === 0) return yield* refuse("preparing");
		return {
			retried: stage,
		};
	});

/** Runs every failed asset of the repository again that the one rule lets run. */
export const prepareRepositoryFailedAgain = (params: {
	userId: UserId;
	blockId: BlockId;
}) =>
	Effect.gen(function* () {
		const failed = (yield* linkedAssets(params)).filter((asset) => {
			const stage = stageOf(asset);
			return (
				assetState(asset).failure !== null &&
				(stage === "processing" || stage === "indexing")
			);
		});
		return yield* runAgain({
			userId: params.userId,
			blockId: params.blockId,
			assets: failed,
		});
	});
