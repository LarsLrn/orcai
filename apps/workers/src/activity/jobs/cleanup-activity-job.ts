import { DB, dbSchema } from "@orcai/db";
import { runningRun } from "@orcai/preparation";
import {
	and,
	isNotNull,
	isNull,
	lt,
	not,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
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

/**
 * Deletes the rows of `table` matching `condition`, a batch per statement;
 * the rows deleted. The batch is picked by `ctid` in one pass, so no plan
 * reruns the condition per row however stale the table's statistics are.
 */
const deleteInBatches = (table: PgTable, condition: SQL | undefined) =>
	Effect.gen(function* () {
		const db = yield* DB;
		let deleted = 0;
		while (true) {
			const batch = yield* db
				.delete(table)
				.where(
					sql`ctid = any(array${db
						.select({
							ctid: sql`ctid`,
						})
						.from(table)
						.where(condition)
						.limit(BATCH_SIZE)})`,
				)
				.returning({
					deleted: sql<number>`1`,
				});
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
		activityRun,
		and(
			not(runningRun),
			or(
				isNotNull(activityRun.dismissedAt),
				lt(activityRun.finishedSeenAt, sql`now() - ${RETENTION}`),
				sql`not exists (select 1 from ${activityMember} where ${activityMember.runId} = ${activityRun.id})`,
			),
		),
	);
	const dismissals = yield* deleteInBatches(activityDismissal, staleDismissal);

	yield* Effect.logInfo(
		{
			runs,
			dismissals,
		},
		"Cleaned up activity",
	);
});
