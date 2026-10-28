import type { AssetId, BlockId } from "@orcai/core";
import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatchInTransaction } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson } from "@orcai/s3/server";
import {
	type AssetFileType,
	type BucketName,
	PROCESS_ASSET_JOB_NAME,
} from "@orcai/schema";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { toSanitizedPgBossRunError } from "@/asset/error-summary";

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
 * to processing once. Processing stores the extraction before it marks the
 * asset completed, so with the completed asset's row locked the extraction
 * read again is current: a caller whose first read was stale indexes the
 * described one, and only one caller queues processing. The claim and its job
 * commit together.
 */
export const describedExtraction = (params: {
	jobId: string;
	asset: ProcessableAsset;
	blockId: BlockId;
}) =>
	Effect.gen(function* () {
		const stored = yield* readExtraction(params.asset.id);
		if (isDescribed(stored)) {
			return stored;
		}

		const db = yield* DB;
		const { asset, blockAsset } = dbSchema;
		const linkPending = db
			.update(blockAsset)
			.set({
				indexStatus: "pending",
				indexFailure: null,
			})
			.where(
				and(
					eq(blockAsset.assetId, params.asset.id),
					eq(blockAsset.blockId, params.blockId),
				),
			);

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const [completed] = yield* db
					.select({
						id: asset.id,
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
					yield* linkPending;
					return undefined;
				}

				const current = yield* readExtraction(params.asset.id);
				if (isDescribed(current)) {
					return current;
				}

				const [claimed] = yield* db
					.update(asset)
					.set({
						processingStatus: "pending",
						processingFailure: null,
						processingGeneration: sql`${asset.processingGeneration} + 1`,
					})
					.where(eq(asset.id, params.asset.id))
					.returning({
						generation: asset.processingGeneration,
					});
				yield* linkPending;
				yield* sendJobBatchInTransaction({
					jobName: PROCESS_ASSET_JOB_NAME,
					jobs: [
						{
							data: {
								assetRef: {
									bucket: params.asset.bucket,
									prefix: params.asset.prefix,
									id: params.asset.id,
									type: params.asset.fileType,
								},
								generation: claimed?.generation,
							},
						},
					],
				});
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
