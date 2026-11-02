import type { AssetId } from "@orcai/core";
import { buckets } from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import { queueProcessing } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson, isS3NoSuchKey } from "@orcai/s3/server";
import type { AssetFileType, BucketName } from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { toSanitizedPgBossRunError } from "@/asset/error-summary";
import {
	AssetPipelineError,
	currentIndexing,
	type IndexingAttempt,
} from "@/asset/pipeline-attempt";

interface ProcessableAsset {
	id: AssetId;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
}

const getExtraction = (assetId: AssetId) =>
	getObjectAsJson<StoredExtractionArtifact>({
		bucket: buckets.processed.name,
		name: buildStoredExtractionKey(assetId),
	});

const readExtraction = (assetId: AssetId) =>
	getExtraction(assetId).pipe(Effect.mapError(toSanitizedPgBossRunError));

const isDescribed = (extraction: StoredExtractionArtifact) =>
	extraction.images.every((image) => image.text !== undefined);

/**
 * The stored extraction of a re-embed: as it is, with its images described.
 * One that is gone or older than image descriptions fails
 * `missing_extraction`, for a person to prepare the file again.
 */
const storedExtraction = (assetId: AssetId) =>
	getExtraction(assetId).pipe(
		Effect.catchIf(isS3NoSuchKey, () => Effect.succeed(undefined)),
		Effect.mapError(toSanitizedPgBossRunError),
		Effect.flatMap((stored) =>
			stored && isDescribed(stored)
				? Effect.succeed(stored)
				: Effect.fail(
						new AssetPipelineError({
							failure: "missing_extraction",
							cause: new Error(
								stored
									? "The stored extraction predates image descriptions"
									: "The stored extraction is missing",
							),
						}),
					),
		),
	);

/**
 * The asset's stored extraction with its images described, or undefined when
 * processing has to describe them first and queues indexing again then. A
 * re-embed takes the stored one as it is.
 *
 * An extraction stored before images were described at processing goes back
 * to processing once, admitted only by the link's current indexing attempt,
 * which the new generation replaces. Processing stores the extraction before
 * it marks the asset completed, so with the completed asset's row locked the
 * extraction read again is current: a caller whose first read was stale
 * indexes the described one, and only one caller queues processing.
 */
export const describedExtraction = (params: {
	jobId: string;
	asset: ProcessableAsset;
	attempt: IndexingAttempt;
}) =>
	Effect.gen(function* () {
		if (params.attempt.fromStoredExtraction) {
			return yield* storedExtraction(params.asset.id);
		}
		const stored = yield* readExtraction(params.asset.id);
		if (isDescribed(stored)) {
			return stored;
		}

		const db = yield* DB;
		const { asset, block, blockAsset } = dbSchema;

		return yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const [completed] = yield* db
						.select({
							processingGeneration: asset.processingGeneration,
						})
						.from(asset)
						.where(
							and(
								eq(asset.id, params.asset.id),
								eq(asset.processingStatus, "completed"),
							),
						)
						.for("update");
					if (!completed) {
						yield* db
							.update(blockAsset)
							.set({
								indexStatus: "pending",
								indexFailure: null,
							})
							.where(currentIndexing(params.attempt));
						return undefined;
					}

					const current = yield* readExtraction(params.asset.id);
					if (isDescribed(current)) {
						return current;
					}

					// Repository before link before member, as repository deletion locks them.
					yield* db
						.select({
							id: block.id,
						})
						.from(block)
						.where(eq(block.id, params.attempt.blockId))
						.for("key share");
					const [link] = yield* db
						.select({
							assetId: blockAsset.assetId,
						})
						.from(blockAsset)
						.where(currentIndexing(params.attempt))
						.for("update");
					if (!link) return undefined;

					yield* queueProcessing(
						{
							...params.asset,
							processingGeneration: completed.processingGeneration,
						},
						[
							"completed",
						],
						params.attempt.runId
							? {
									id: params.attempt.runId,
									blockId: params.attempt.blockId,
								}
							: undefined,
					);
					yield* Effect.logInfo(
						{
							jobId: params.jobId,
							assetId: params.asset.id,
						},
						"Processing again to describe the images of an older extraction",
					);
					return undefined;
				}),
			),
		);
	});
