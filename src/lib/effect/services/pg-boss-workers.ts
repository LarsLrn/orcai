import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import * as Schedule from "effect/Schedule";
import type { Job, PgBoss } from "pg-boss";
import type { DoclingService } from "@/lib/effect/services/docling";
import type { DB } from "@/lib/effect/services/drizzle";
import type { QdrantService } from "@/lib/effect/services/qdrant";
import { PgBossWorkersError } from "@/lib/effect/utils/errors";
import { processAssetBatchEffect } from "@/lib/pg-boss/jobs/process-asset-job";
import { verifyQuotaDailyBatchEffect } from "@/lib/pg-boss/jobs/quota-daily-verify-job";
import { rolloverQuotaPeriodBatchEffect } from "@/lib/pg-boss/jobs/quota-period-rollover-job";
import { reconcileQuotaBatchEffect } from "@/lib/pg-boss/jobs/quota-reconcile-job";
import { vectorizeAssetBatchEffect } from "@/lib/pg-boss/jobs/vectorize-asset-job";
import {
	type JobQueue,
	PROCESS_ASSET_JOB_NAME,
	QUOTA_DAILY_VERIFY_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RECONCILE_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@/lib/pg-boss/schema/job-queues";
import type { ProcessAssetPayload } from "@/lib/pg-boss/schema/process-asset";
import type { VectorizeAssetPayload } from "@/lib/pg-boss/schema/vectorize-asset";
import type { QuotaCounterStore } from "@/lib/quota/counter-store";
import type { AppConfigService } from "./config";
import { PgBossService } from "./pg-boss";
import type { S3Service } from "./s3";

// Exponential backoff starting at 1s, with jitter, max 10 retries
const retryPolicy = Schedule.exponential("1 second").pipe(
	Schedule.intersect(Schedule.recurs(9)),
	Schedule.jittered,
);

const createQueue = (name: JobQueue) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		yield* Effect.tryPromise({
			try: () =>
				boss.createQueue(name, {
					retryLimit: 3,
					retryDelay: 60,
					expireInSeconds: 3600,
				}),
			catch: (error) =>
				new PgBossWorkersError({
					step: "create-queue",
					queue: name,
					cause: error,
				}),
		}).pipe(Effect.retry(retryPolicy));
	});

const summarizeWorkerError = (error: unknown): Record<string, unknown> => {
	const stringField = (value: unknown) =>
		typeof value === "string" ? value : undefined;

	if (error instanceof Error) {
		const details = error as Error & Record<string, unknown>;
		const nested = details.cause as Record<string, unknown> | undefined;
		return Object.fromEntries(
			Object.entries({
				name: error.name,
				message: error.message || undefined,
				tag: stringField(details._tag),
				queue: stringField(details.queue),
				step: stringField(details.step),
				causeName: nested ? stringField(nested.name) : undefined,
				causeTag: nested ? stringField(nested._tag) : undefined,
				causeMessage: nested ? stringField(nested.message) : undefined,
			}).filter(([, value]) => value !== undefined),
		);
	}

	if (error && typeof error === "object") {
		const details = error as Record<string, unknown>;
		const nested = details.cause as Record<string, unknown> | undefined;
		return Object.fromEntries(
			Object.entries({
				name: stringField(details.name),
				message: stringField(details.message),
				tag: stringField(details._tag),
				queue: stringField(details.queue),
				step: stringField(details.step),
				causeName: nested ? stringField(nested.name) : undefined,
				causeTag: nested ? stringField(nested._tag) : undefined,
				causeMessage: nested ? stringField(nested.message) : undefined,
			}).filter(([, value]) => value !== undefined),
		);
	}

	return {
		message: String(error),
	};
};

const registerWorkers = Effect.gen(function* () {
	const { boss } = yield* PgBossService;
	type WorkerContext =
		| PgBossService
		| S3Service
		| AppConfigService
		| QdrantService
		| DoclingService
		| DB
		| QuotaCounterStore;

	// Capture the full runtime so worker callbacks have access to all
	// services that their effects may require
	const rt = yield* Effect.runtime<WorkerContext>();

	type WorkerRegistration = {
		name: JobQueue;
		register: (boss: PgBoss) => Promise<string>;
	};

	const runWorkerBatch =
		<TPayload>(
			queue: JobQueue,
			handler: (
				jobs: Job<TPayload>[],
			) => Effect.Effect<void, unknown, WorkerContext>,
		) =>
		(jobs: Job<TPayload>[]) =>
			Runtime.runPromise(rt)(
				handler(jobs).pipe(
					Effect.mapError((cause) =>
						cause instanceof PgBossWorkersError
							? cause
							: new PgBossWorkersError({
									queue,
									step: "run-worker",
									cause,
								}),
					),
					Effect.tapError((error) =>
						Effect.logError(
							{
								queue,
								jobIds: jobs.map((job) => job.id),
								jobCount: jobs.length,
								err: summarizeWorkerError(error),
							},
							"pg-boss worker batch failed",
						),
					),
				),
			);

	const workers: readonly WorkerRegistration[] = [
		{
			name: PROCESS_ASSET_JOB_NAME,
			register: (boss) =>
				boss.work<ProcessAssetPayload>(
					PROCESS_ASSET_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 2,
						pollingIntervalSeconds: 2,
					},
					runWorkerBatch(PROCESS_ASSET_JOB_NAME, processAssetBatchEffect),
				),
		},
		{
			name: VECTORIZE_ASSET_JOB_NAME,
			register: (boss) =>
				boss.work<VectorizeAssetPayload>(
					VECTORIZE_ASSET_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 2,
						pollingIntervalSeconds: 2,
					},
					runWorkerBatch(VECTORIZE_ASSET_JOB_NAME, vectorizeAssetBatchEffect),
				),
		},
		{
			name: QUOTA_PERIOD_ROLLOVER_JOB_NAME,
			register: (boss) =>
				boss.work<unknown>(
					QUOTA_PERIOD_ROLLOVER_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 1,
						pollingIntervalSeconds: 5,
					},
					runWorkerBatch(
						QUOTA_PERIOD_ROLLOVER_JOB_NAME,
						rolloverQuotaPeriodBatchEffect,
					),
				),
		},
		{
			name: QUOTA_RECONCILE_JOB_NAME,
			register: (boss) =>
				boss.work<unknown>(
					QUOTA_RECONCILE_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 1,
						pollingIntervalSeconds: 5,
					},
					runWorkerBatch(QUOTA_RECONCILE_JOB_NAME, reconcileQuotaBatchEffect),
				),
		},
		{
			name: QUOTA_DAILY_VERIFY_JOB_NAME,
			register: (boss) =>
				boss.work<unknown>(
					QUOTA_DAILY_VERIFY_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 1,
						pollingIntervalSeconds: 30,
					},
					runWorkerBatch(
						QUOTA_DAILY_VERIFY_JOB_NAME,
						verifyQuotaDailyBatchEffect,
					),
				),
		},
	];

	yield* Effect.forEach(
		workers,
		({ name, register }) =>
			Effect.tryPromise({
				try: () => register(boss),
				catch: (error) =>
					new PgBossWorkersError({
						step: "register-worker",
						queue: name,
						cause: error,
					}),
			}).pipe(
				Effect.retry(retryPolicy),
				Effect.tapError((error) =>
					Effect.logError(
						`worker registration failed: ${name} (${String(error)})`,
					),
				),
			),
		{
			discard: true,
		},
	);
});

const scheduleQuotaJobs = Effect.gen(function* () {
	const { boss } = yield* PgBossService;

	yield* Effect.tryPromise({
		try: () => boss.schedule(QUOTA_PERIOD_ROLLOVER_JOB_NAME, "*/5 * * * *", {}),
		catch: (cause) =>
			new PgBossWorkersError({
				queue: QUOTA_PERIOD_ROLLOVER_JOB_NAME,
				step: "register-worker",
				cause,
			}),
	}).pipe(Effect.retry(retryPolicy));

	yield* Effect.tryPromise({
		try: () => boss.schedule(QUOTA_RECONCILE_JOB_NAME, "*/2 * * * *", {}),
		catch: (cause) =>
			new PgBossWorkersError({
				queue: QUOTA_RECONCILE_JOB_NAME,
				step: "register-worker",
				cause,
			}),
	}).pipe(Effect.retry(retryPolicy));

	yield* Effect.tryPromise({
		try: () => boss.schedule(QUOTA_DAILY_VERIFY_JOB_NAME, "0 2 * * *", {}),
		catch: (cause) =>
			new PgBossWorkersError({
				queue: QUOTA_DAILY_VERIFY_JOB_NAME,
				step: "register-worker",
				cause,
			}),
	}).pipe(Effect.retry(retryPolicy));
});

export const PgBossWorkersLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		yield* Effect.logInfo("Starting pg-boss workers...");

		// Create queues first — these must succeed for workers to function.
		yield* Effect.all(
			[
				createQueue(VECTORIZE_ASSET_JOB_NAME),
				createQueue(PROCESS_ASSET_JOB_NAME),
				createQueue(QUOTA_PERIOD_ROLLOVER_JOB_NAME),
				createQueue(QUOTA_RECONCILE_JOB_NAME),
				createQueue(QUOTA_DAILY_VERIFY_JOB_NAME),
			],
			{
				discard: true,
				concurrency: "unbounded",
			},
		).pipe(
			Effect.tapError(() =>
				Effect.logError(
					"Failed to create pg-boss queues after retries, workers cannot start",
				),
			),
		);

		// Register workers after queues are confirmed.
		yield* registerWorkers;
		yield* scheduleQuotaJobs;

		yield* Effect.logInfo("pg-boss workers started");

		yield* Effect.addFinalizer(() =>
			Effect.logInfo("pg-boss workers stopping (boss shutdown will follow)"),
		);
	}),
);
