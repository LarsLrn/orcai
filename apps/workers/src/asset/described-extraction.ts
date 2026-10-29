import type { AssetId } from "@orcai/core";
import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { queueProcessing } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson } from "@orcai/s3/server";
import type { AssetFileType, BucketName } from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { toSanitizedPgBossRunError } from "@/asset/error-summary";
import {
	currentIndexing,
	type IndexingAttempt,
} from "@/asset/pipeline-attempt";

interface ProcessableAsset {
	id: AssetId;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
}

const readExtraction = (assetId: AssetId) =>
	getObjectAsJson<StoredExtractionArtifact>({
		bucket: buckets.processed.name,
		name: buildStoredExtractionKey(assetId),
	}).pipe(Effect.mapError(toSanitizedPgBossRunError));

const isDescribed = (extraction: StoredExtractionArtifact) =>
	extraction.images.every((image) => image.text !== undefined);

/**
 * The asset's stored extraction with its images described, or undefined when
 * processing has to describe them first and queues indexing again then.
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
		const stored = yield* readExtraction(params.asset.id);
		if (isDescribed(stored)) {
			return stored;
		}

		const db = yield* DB;
		const { asset, blockAsset } = dbSchema;

		return yield* db.transaction(() =>
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
		);
	});
