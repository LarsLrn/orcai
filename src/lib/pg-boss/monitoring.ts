import { getPgBoss } from "./pg-boss-client";

/**
 * Utility functions for monitoring and managing pg-boss jobs
 */

export async function getJobStatus(queueName: string, jobId: string) {
	const boss = await getPgBoss();
	const job = await boss.getJobById(queueName, jobId);
	return job;
}

export async function getQueueInfo(queueName: string) {
	const boss = await getPgBoss();
	const queue = await boss.getQueue(queueName);
	return queue;
}

export async function cancelJob(queueName: string, jobId: string) {
	const boss = await getPgBoss();
	await boss.cancel(queueName, jobId);
}

export async function resumeJob(queueName: string, jobId: string) {
	const boss = await getPgBoss();
	await boss.resume(queueName, jobId);
}

/**
 * Get statistics for all queues
 */
export async function getAllQueueStats() {
	const boss = await getPgBoss();

	const queues = await boss.getQueues();
	return queues;
}

/**
 * Cleanup old completed/failed jobs manually
 */
export async function cleanupOldJobs(queueName?: string) {
	const boss = await getPgBoss();

	await boss.deleteAllJobs(queueName);
}

/**
 * Get failed jobs for debugging (using direct database access)
 */
export async function getFailedJobs(limit = 10) {
	const boss = await getPgBoss();
	const db = boss.getDb();

	const result = await db.executeSql(
		`
		SELECT id, name, data, output, createdon, completedon
		FROM pgboss.job
		WHERE state = 'failed'
		ORDER BY completedon DESC
		LIMIT $1
	`,
		[limit],
	);

	return result.rows;
}
