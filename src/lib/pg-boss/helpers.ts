import { getPgBoss } from "./pg-boss-client";
import type { Job } from "./schema/job";

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
export async function getJobsByResource(
	resourceId: string,
	options?: {
		queueName?: string;
		limit?: number;
		// if your payload key is not assetId, rename this or change the query
		dataKey?: string; // optional improvement
	},
) {
	const boss = await getPgBoss();
	const db = boss.getDb();

	const dataKey = options?.dataKey ?? "resourceId"; // or "resourceId" if that's what you store
	const where: string[] = [];
	const params: any[] = [];

	// data->>'key' = value, with key safely injected via identifier-like whitelist
	// IMPORTANT: you cannot parameterize JSON key names; use a whitelist.
	const allowedKeys = new Set(["assetId", "resourceId"]);
	if (!allowedKeys.has(dataKey)) {
		throw new Error(`Invalid dataKey: ${dataKey}`);
	}

	params.push(resourceId);
	where.push(`data->>'${dataKey}' = $${params.length}`);

	if (options?.queueName) {
		params.push(options.queueName);
		where.push(`name = $${params.length}`);
	}

	const limit = Math.max(1, Math.min(options?.limit ?? 100, 1000));
	params.push(limit);
	const limitPlaceholder = `$${params.length}`;

	const sql = `
    SELECT
      id,
      name,
      data,
      state,
      priority,
      retry_limit  AS "retryLimit",
      retry_count  AS "retryCount",
      retry_delay  AS "retryDelay",
      created_on   AS "createdOn",
      started_on   AS "startedOn",
      completed_on AS "completedOn",
			expire_seconds AS "expireSeconds",
			deletion_seconds AS "deletionSeconds",
			start_after	 AS "startAfter",
			keep_until	 AS "keepUntil",
      output
    FROM pgboss.job
    WHERE ${where.join(" AND ")}
    ORDER BY created_on DESC
    LIMIT ${limitPlaceholder}
  `;

	const result = await db.executeSql(sql, params);
	return result.rows as Job[];
}
