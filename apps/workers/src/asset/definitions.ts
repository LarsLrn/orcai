import type { PgClient } from "@effect/sql-pg";
import type { AiConfigService, EncryptionKey } from "@orcai/ai";
import type { DB } from "@orcai/db";
import type { PgBossService } from "@orcai/pg-boss";
import type { QdrantService } from "@orcai/qdrant";
import type { S3Service } from "@orcai/s3/server";
import {
	type JobQueue,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { processAssetBatch } from "@/asset/jobs/process-asset-job";
import { vectorizeAssetBatch } from "@/asset/jobs/vectorize-asset-job";
import {
	markIndexingExhausted,
	markProcessingExhausted,
} from "@/asset/pipeline-failure";
import type { WorkerDefinition } from "@/worker/types";

export type AssetWorkerContext =
	| DB
	| S3Service
	| QdrantService
	| PgBossService
	| AiConfigService
	| EncryptionKey
	| PgClient.PgClient;

const assetWorker = <TPayload>(
	definition: WorkerDefinition<AssetWorkerContext, TPayload>,
) => definition;

export const assetWorkerDefinitions = [
	assetWorker<ProcessAssetPayload>({
		name: PROCESS_ASSET_JOB_NAME as JobQueue,
		deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 1,
			localConcurrency: 2,
			pollingIntervalSeconds: 2,
		},
		handler: processAssetBatch,
	}),
	assetWorker<VectorizeAssetPayload>({
		name: VECTORIZE_ASSET_JOB_NAME as JobQueue,
		deadLetter: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 1,
			localConcurrency: 2,
			pollingIntervalSeconds: 2,
		},
		handler: vectorizeAssetBatch,
	}),
	assetWorker<ProcessAssetPayload>({
		name: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 10,
			localConcurrency: 1,
			pollingIntervalSeconds: 2,
		},
		handler: markProcessingExhausted,
	}),
	assetWorker<VectorizeAssetPayload>({
		name: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 10,
			localConcurrency: 1,
			pollingIntervalSeconds: 2,
		},
		handler: markIndexingExhausted,
	}),
] as const;
