import type { AiConfigService } from "@orcai/ai";
import type { DB } from "@orcai/db";
import type { PgBossService } from "@orcai/pg-boss";
import type { QdrantService } from "@orcai/qdrant";
import type { S3Service } from "@orcai/s3/server";
import {
	type JobQueue,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { processAssetBatchEffect } from "@/asset/jobs/process-asset-job";
import { vectorizeAssetBatchEffect } from "@/asset/jobs/vectorize-asset-job";
import type { WorkerDefinition } from "@/worker/types";

export type AssetWorkerContext =
	| DB
	| S3Service
	| QdrantService
	| PgBossService
	| AiConfigService;

const assetWorker = <TPayload>(
	definition: WorkerDefinition<AssetWorkerContext, TPayload>,
) => definition;

export const assetWorkerDefinitions = [
	assetWorker<ProcessAssetPayload>({
		name: PROCESS_ASSET_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 2,
			pollingIntervalSeconds: 2,
		},
		handler: processAssetBatchEffect,
	}),
	assetWorker<VectorizeAssetPayload>({
		name: VECTORIZE_ASSET_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 2,
			pollingIntervalSeconds: 2,
		},
		handler: vectorizeAssetBatchEffect,
	}),
] as const;
