import {
	handleProcessAssetJob,
	PROCESS_ASSET_JOB_NAME,
} from "./jobs/process-asset-job";
import {
	handleVectorizeAssetJob,
	VECTORIZE_ASSET_JOB_NAME,
} from "./jobs/vectorize-asset-job";
import { getPgBoss, shutdownPgBoss } from "./pg-boss-client";

export async function startPgBossWorkers() {
	const boss = await getPgBoss();

	console.log("Starting pg-boss workers...");

	// Create queues
	await boss.createQueue(VECTORIZE_ASSET_JOB_NAME, {
		retryLimit: 3,
		retryDelay: 60,
		expireInSeconds: 3600,
	});

	await boss.createQueue(PROCESS_ASSET_JOB_NAME, {
		retryLimit: 3,
		retryDelay: 60,
		expireInSeconds: 3600,
	});

	// Register workers
	await boss.work(VECTORIZE_ASSET_JOB_NAME, handleVectorizeAssetJob);
	await boss.work(PROCESS_ASSET_JOB_NAME, handleProcessAssetJob);

	console.log("pg-boss workers started successfully");

	return boss;
}

export async function stopPgBossWorkers() {
	console.log("Stopping pg-boss workers...");
	await shutdownPgBoss();
	console.log("pg-boss workers stopped");
}
