import { defineWorker } from "@orcai/pg-boss";
import {
	cleanUpDueDeletions,
	markIndexingExhausted,
	markMetadataExhausted,
	markProcessingExhausted,
	prepareMissingExtractionsAgain,
	reconcileEmbeddings,
	sweepPreparation,
} from "@orcai/preparation";
import {
	DELETION_CLEANUP_JOB_NAME,
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	generateAssetMetadataPayloadSchema,
	PREPARATION_SWEEP_JOB_NAME,
	PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	prepareMissingExtractionsAgainPayloadSchema,
	processAssetPayloadSchema,
	RECONCILE_EMBEDDINGS_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	vectorizeAssetPayloadSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { generateMetadata } from "@/asset/jobs/generate-metadata-job";
import { processAsset } from "@/asset/jobs/process-asset-job";
import { vectorizeAsset } from "@/asset/jobs/vectorize-asset-job";

export const assetWorkers = [
	defineWorker({
		queue: PROCESS_ASSET_JOB_NAME,
		payload: processAssetPayloadSchema,
		concurrency: 2,
		pollingIntervalSeconds: 2,
		handler: processAsset,
	}),
	defineWorker({
		queue: VECTORIZE_ASSET_JOB_NAME,
		payload: vectorizeAssetPayloadSchema,
		concurrency: 2,
		pollingIntervalSeconds: 2,
		handler: vectorizeAsset,
	}),
	defineWorker({
		queue: GENERATE_ASSET_METADATA_JOB_NAME,
		payload: generateAssetMetadataPayloadSchema,
		concurrency: 2,
		pollingIntervalSeconds: 2,
		handler: generateMetadata,
	}),
	defineWorker({
		queue: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
		payload: processAssetPayloadSchema,
		concurrency: 1,
		pollingIntervalSeconds: 2,
		handler: markProcessingExhausted,
	}),
	defineWorker({
		queue: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
		payload: vectorizeAssetPayloadSchema,
		concurrency: 1,
		pollingIntervalSeconds: 2,
		handler: markIndexingExhausted,
	}),
	defineWorker({
		queue: GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
		payload: generateAssetMetadataPayloadSchema,
		concurrency: 1,
		pollingIntervalSeconds: 2,
		handler: markMetadataExhausted,
	}),
	defineWorker({
		queue: PREPARATION_SWEEP_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 30,
		handler: () => sweepPreparation,
	}),
	defineWorker({
		queue: DELETION_CLEANUP_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 30,
		handler: () => cleanUpDueDeletions,
	}),
	defineWorker({
		queue: RECONCILE_EMBEDDINGS_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 5,
		handler: () =>
			reconcileEmbeddings.pipe(
				Effect.tap((admitted) =>
					admitted > 0
						? Effect.logInfo(
								{
									admitted,
								},
								"Admitted repository links to the active embedding generation",
							)
						: Effect.void,
				),
			),
	}),
	defineWorker({
		queue: PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
		payload: prepareMissingExtractionsAgainPayloadSchema,
		concurrency: 1,
		pollingIntervalSeconds: 2,
		handler: (job) =>
			prepareMissingExtractionsAgain(job.data).pipe(
				Effect.tap((queued) =>
					Effect.logInfo(
						{
							queued,
						},
						"Queued assets missing their stored extraction for preparation",
					),
				),
			),
	}),
];
