import { getPgBoss } from "./pg-boss-client";
import type { Job, JobQueue } from "./schema/job";

/**
 * Send a single job to pg-boss
 * Store metadata in the job data itself - no need for separate task table
 */
export async function sendJob<T extends object = object>(
	jobName: string,
	data: T & { resourceId?: string; resourceType?: string },
	options: {
		resourceId: string;
		resourceType: "block" | "course" | "chat";
		priority?: number;
		retryLimit?: number;
		retryDelay?: number;
		expireInSeconds?: number;
	},
) {
	const boss = await getPgBoss();

	// Include metadata in the job data
	const jobData = {
		...data,
		resourceId: options.resourceId,
		resourceType: options.resourceType,
	};

	// Send the job to pg-boss
	const jobId = await boss.send(jobName, jobData, {
		priority: options.priority,
		retryLimit: options.retryLimit ?? 3,
		retryDelay: options.retryDelay ?? 60,
		expireInSeconds: options.expireInSeconds ?? 3600,
	});

	if (!jobId) {
		throw new Error("Failed to create job");
	}

	return jobId;
}

/**
 * Send multiple jobs in batch
 */
export async function sendJobBatch<T extends object = object>(
	jobName: string,
	jobs: Array<{
		data: T & { resourceId?: string; resourceType?: string };
		options?: {
			priority?: number;
			retryLimit?: number;
			retryDelay?: number;
		};
	}>,
	resourceOptions: {
		resourceId: string;
		resourceType: "block" | "course" | "chat";
	},
) {
	const boss = await getPgBoss();

	// Insert all jobs at once with metadata included
	// FIXME: For some reason, boss.insert always returns void instead of job IDs?
	await boss.insert(
		jobName,
		jobs.map((job) => ({
			data: {
				...job.data,
				resourceId: resourceOptions.resourceId,
				resourceType: resourceOptions.resourceType,
			},
			priority: job.options?.priority,
			retryLimit: job.options?.retryLimit ?? 3,
			retryDelay: job.options?.retryDelay ?? 60,
		})),
		{},
	);
}

/**
 * Get all pg-boss jobs for a specific resource.
 * Reads canonical records from pgboss.job (not pgboss.job_common).
 */
export async function getJobsByResource({
	jobQueue,
	resourceId,
}: {
	jobQueue: JobQueue;
	resourceId: string;
}) {
	const boss = await getPgBoss();

	const dataKey = jobQueue === "process-asset-job" ? "resourceId" : "blockId";

	const data = await boss.findJobs(jobQueue, {
		data: { [dataKey]: resourceId },
	});

	return data as Job[];
}
