import {
	ACTIVITY_CLEANUP_JOB_NAME,
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_EXPIRE_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	DATA_EXPORT_SWEEP_JOB_NAME,
	DELETION_CLEANUP_JOB_NAME,
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type JobQueue,
	NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
	NOTIFICATION_OUTBOX_JOB_NAME,
	PREPARATION_SWEEP_JOB_NAME,
	PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RELEASE_STALE_JOB_NAME,
	RECONCILE_EMBEDDINGS_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { PgBossWorkersError } from "./errors";
import { PgBossService } from "./service";

type QueueSettings = {
	readonly retryLimit: number;
	/** Seconds; with `retryBackoff`, the first delay of an exponential backoff. */
	readonly retryDelay: number;
	readonly retryBackoff: boolean;
	readonly expireInSeconds: number;
	/** Takes the jobs whose retries ran out. */
	readonly deadLetter?: JobQueue;
	/** `stately` drops a send while a job of the queue waits. */
	readonly policy?: "stately";
	/** A cron that queues a job on every tick. */
	readonly schedule?: string;
};

/** Four runs a minute apart, each up to an hour. */
const work = {
	retryLimit: 3,
	retryDelay: 60,
	retryBackoff: false,
	expireInSeconds: 3600,
} as const;

/**
 * A dead letter handler only writes, so it retries more often with backoff:
 * the n-th retry waits 5 * 2^(n-1) to 5 * 2^n seconds, 315 to 630 seconds
 * over all six. pg-boss copies no delay cap onto a dead-lettered job.
 */
const deadLetter = {
	retryLimit: 6,
	retryDelay: 5,
	retryBackoff: true,
	expireInSeconds: 300,
} as const;

/** How pg-boss keeps and retries the jobs of every queue, in every process and test. */
export const QUEUES: { readonly [Q in JobQueue]: QueueSettings } = {
	[PROCESS_ASSET_JOB_NAME]: {
		...work,
		deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	},
	[PROCESS_ASSET_DEAD_LETTER_JOB_NAME]: deadLetter,
	[VECTORIZE_ASSET_JOB_NAME]: {
		...work,
		deadLetter: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	},
	[VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME]: deadLetter,
	[GENERATE_ASSET_METADATA_JOB_NAME]: {
		...work,
		deadLetter: GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	},
	[GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME]: deadLetter,
	[DATA_EXPORT_JOB_NAME]: {
		...work,
		deadLetter: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	},
	[DATA_EXPORT_DEAD_LETTER_JOB_NAME]: deadLetter,
	[PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME]: {
		...work,
		policy: "stately",
	},
	[PREPARATION_SWEEP_JOB_NAME]: {
		...work,
		schedule: "*/5 * * * *",
	},
	[DELETION_CLEANUP_JOB_NAME]: {
		...work,
		schedule: "*/5 * * * *",
	},
	[RECONCILE_EMBEDDINGS_JOB_NAME]: {
		...work,
		schedule: "* * * * *",
	},
	[QUOTA_PERIOD_ROLLOVER_JOB_NAME]: {
		...work,
		schedule: "*/5 * * * *",
	},
	[QUOTA_RELEASE_STALE_JOB_NAME]: {
		...work,
		schedule: "*/5 * * * *",
	},
	[NOTIFICATION_OUTBOX_JOB_NAME]: {
		...work,
		schedule: "* * * * *",
	},
	[NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME]: {
		...work,
		schedule: "15 2 * * *",
	},
	[ACTIVITY_CLEANUP_JOB_NAME]: {
		...work,
		schedule: "25 * * * *",
	},
	[DATA_EXPORT_EXPIRE_JOB_NAME]: {
		...work,
		schedule: "*/10 * * * *",
	},
	[DATA_EXPORT_SWEEP_JOB_NAME]: {
		...work,
		schedule: "*/5 * * * *",
	},
};

export const startupRetry = Schedule.max([
	Schedule.exponential("1 second"),
	Schedule.recurs(9),
]).pipe(Schedule.jittered);

/** The queues with their dead letter queues, each dead letter first. */
const withDeadLetters = (names: readonly JobQueue[]): JobQueue[] => [
	...new Set(
		names.flatMap((name) => {
			const { deadLetter } = QUEUES[name];
			return deadLetter
				? [
						...withDeadLetters([
							deadLetter,
						]),
						name,
					]
				: [
						name,
					];
		}),
	),
];

/** Creates the queues and their dead letter queues, or brings existing ones to the table. */
export const ensureQueues = (names: readonly JobQueue[]) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		yield* Effect.forEach(
			withDeadLetters(names),
			(name) => {
				const { policy, schedule: _, ...settings } = QUEUES[name];
				return Effect.tryPromise({
					try: async () => {
						await boss.createQueue(name, {
							...settings,
							policy,
						});
						await boss.updateQueue(name, {
							...settings,
							deadLetter: settings.deadLetter ?? null,
						});
					},
					catch: (cause) =>
						new PgBossWorkersError({
							queue: name,
							step: "create-queue",
							cause,
						}),
				}).pipe(Effect.retry(startupRetry));
			},
			{
				discard: true,
			},
		);
	});
