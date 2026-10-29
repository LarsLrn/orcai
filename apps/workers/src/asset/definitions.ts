import type { PgClient } from "@effect/sql-pg";
import type { AiConfigService, EncryptionKey } from "@orcai/ai";
import type { DB } from "@orcai/db";
import type { PgBossService } from "@orcai/pg-boss";
import type { QdrantService } from "@orcai/qdrant";
import type { S3Service } from "@orcai/s3/server";
import {
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type JobQueue,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { generateMetadataBatch } from "@/asset/jobs/generate-metadata-job";
import { processAssetBatch } from "@/asset/jobs/process-asset-job";
import { vectorizeAssetBatch } from "@/asset/jobs/vectorize-asset-job";
import {
	markIndexingExhausted,
	markMetadataExhausted,
	markProcessingExhausted,
} from "@/asset/pipeline-attempt";
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
	assetWorker<GenerateAssetMetadataPayload>({
		name: GENERATE_ASSET_METADATA_JOB_NAME as JobQueue,
		deadLetter: GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 1,
			localConcurrency: 2,
			pollingIntervalSeconds: 2,
		},
		handler: generateMetadataBatch,
	}),
	assetWorker<GenerateAssetMetadataPayload>({
		name: GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
		workOptions: {
			batchSize: 10,
			localConcurrency: 1,
			pollingIntervalSeconds: 2,
		},
		handler: markMetadataExhausted,
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
