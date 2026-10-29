import { DB, dbSchema } from "@orcai/db";
import { type Job, runningRun } from "@orcai/pg-boss";
import { and, inArray, isNotNull, isNull, lt, not, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

export const BATCH_SIZE = 1000;

/** How long a finished run stays in its user's activity. */
const RETENTION = sql`interval '7 days'`;

const {
	activityAdmission,
	activityDismissal,
	activityMember,
	activityRun,
	asset,
	blockAsset,
	dataExport,
} = dbSchema;

/** Runs `deleteBatch` until it deletes less than a batch; the rows deleted. */
const deleteInBatches = <E, R>(
	deleteBatch: Effect.Effect<readonly unknown[], E, R>,
) =>
	Effect.gen(function* () {
		let deleted = 0;
		while (true) {
			const batch = yield* deleteBatch;
			deleted += batch.length;
			if (batch.length < BATCH_SIZE) return deleted;
		}
	});

/** A dismissed failure no longer current; each lookup has its partial index. */
const staleDismissal = and(
	sql`not exists (select 1 from ${asset} where ${asset.processingFailureId} = ${activityDismissal.occurrenceId})`,
	sql`not exists (select 1 from ${asset} where ${asset.metadataFailureId} = ${activityDismissal.occurrenceId})`,
	sql`not exists (select 1 from ${blockAsset} where ${blockAsset.indexFailureId} = ${activityDismissal.occurrenceId})`,
	sql`not exists (select 1 from ${dataExport} where ${dataExport.id} = ${activityDismissal.occurrenceId} and ${dataExport.status} = 'failed')`,
);

/**
 * Keeps activity bounded: drops lapsed admission leases, deletes runs
 * dismissed, empty or finished for longer than the retention, and
 * dismissals of failures that are no longer current. A run still running
 * stays, whoever may read its members; attention comes from the targets and
 * outlives the runs.
 */
export const cleanupActivity = Effect.gen(function* () {
	const db = yield* DB;

	yield* db
		.delete(activityAdmission)
		.where(lt(activityAdmission.leaseUntil, sql`now()`));

	yield* db
		.update(activityRun)
		.set({
			finishedSeenAt: sql`now()`,
		})
		.where(and(isNull(activityRun.finishedSeenAt), not(runningRun)));
	yield* db
		.update(activityRun)
		.set({
			finishedSeenAt: null,
		})
		.where(and(isNotNull(activityRun.finishedSeenAt), runningRun));

	const runs = yield* deleteInBatches(
		db
			.delete(activityRun)
			.where(
				inArray(
					activityRun.id,
					db
						.select({
							id: activityRun.id,
						})
						.from(activityRun)
						.where(
							and(
								not(runningRun),
								or(
									isNotNull(activityRun.dismissedAt),
									lt(activityRun.finishedSeenAt, sql`now() - ${RETENTION}`),
									sql`not exists (select 1 from ${activityMember} where ${activityMember.runId} = ${activityRun.id})`,
								),
							),
						)
						.limit(BATCH_SIZE),
				),
			)
			.returning({
				id: activityRun.id,
			}),
	);

	const dismissals = yield* deleteInBatches(
		db
			.delete(activityDismissal)
			.where(
				sql`(${activityDismissal.userId}, ${activityDismissal.occurrenceId}) in ${db
					.select({
						userId: activityDismissal.userId,
						occurrenceId: activityDismissal.occurrenceId,
					})
					.from(activityDismissal)
					.where(staleDismissal)
					.limit(BATCH_SIZE)}`,
			)
			.returning({
				occurrenceId: activityDismissal.occurrenceId,
			}),
	);

	yield* Effect.logInfo(
		{
			runs,
			dismissals,
		},
		"Cleaned up activity",
	);
});

export const cleanupActivityBatch = (_jobs: Job<unknown>[]) => cleanupActivity;
