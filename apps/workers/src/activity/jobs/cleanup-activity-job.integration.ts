import { expect, test } from "bun:test";
import type { ActivityRunId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { leaseRun } from "@orcai/preparation";
import { defaultRepositoryConfig } from "@orcai/schema";
import { createUser, integrationRuntime, rolledBack } from "@orcai/testing";
import { eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";
import {
	BATCH_SIZE,
	cleanupActivity,
} from "@/activity/jobs/cleanup-activity-job";

const TIMEOUT = 30_000;

const { runPromise: run } = integrationRuntime();

test(
	"keeps running and recent runs, runs a queued preparation job holds, and current dismissals, and deletes the rest",
	async () => {
		const { seeded, runs, dismissals, leases } = await run(
			rolledBack(
				Effect.gen(function* () {
					const db = yield* DB;
					const user = yield* createUser();
					const [asset] = yield* db
						.insert(dbSchema.asset)
						.values({
							bucket: "uploads",
							prefix: `users/${user.id}/asset`,
							title: "Cleanup asset",
							size: 1,
							fileType: "pdf",
							userId: user.id,
							processingStatus: "failed",
							processingFailureId: sql`gen_random_uuid()`,
						})
						.returning();
					const runOf = (values: {
						finishedSeenAt?: ReturnType<typeof sql>;
						dismissedAt?: Date;
						member?: "pending" | "completed";
					}) =>
						Effect.gen(function* () {
							const [created] = yield* db
								.insert(dbSchema.activityRun)
								.values({
									userId: user.id,
									kind: "retry",
									finishedSeenAt: values.finishedSeenAt,
									dismissedAt: values.dismissedAt,
								})
								.returning();
							if (values.member) {
								yield* db.insert(dbSchema.activityMember).values({
									runId: created.id,
									assetId: asset.id,
									processingState: values.member,
								});
							}
							return created.id;
						});
					const longAgo = sql`now() - interval '8 days'`;
					const ids = {
						recent: yield* runOf({
							member: "completed",
						}),
						expired: yield* runOf({
							member: "completed",
							finishedSeenAt: longAgo,
						}),
						running: yield* runOf({
							member: "pending",
							finishedSeenAt: longAgo,
						}),
						dismissed: yield* runOf({
							member: "completed",
							dismissedAt: new Date(),
						}),
						crashed: yield* runOf({}),
						queued: yield* runOf({}),
					};
					// Its job waits however long the workers are down.
					yield* leaseRun(ids.queued);
					yield* db.insert(dbSchema.activityAdmission).values({
						runId: ids.crashed,
						leaseUntil: sql`now() - interval '1 second'`,
					});
					yield* db.insert(dbSchema.activityDismissal).values([
						{
							userId: user.id,
							occurrenceId: asset.processingFailureId as string,
						},
						{
							userId: user.id,
							occurrenceId: crypto.randomUUID(),
						},
					]);
					const seeded = {
						user,
						asset,
						ids,
					};

					yield* cleanupActivity;

					const runs = yield* db
						.select({
							id: dbSchema.activityRun.id,
							finishedSeenAt: dbSchema.activityRun.finishedSeenAt,
						})
						.from(dbSchema.activityRun)
						.where(eq(dbSchema.activityRun.userId, seeded.user.id));
					const dismissals = yield* db
						.select({
							occurrenceId: dbSchema.activityDismissal.occurrenceId,
						})
						.from(dbSchema.activityDismissal)
						.where(eq(dbSchema.activityDismissal.userId, seeded.user.id));
					const leases = yield* db
						.select()
						.from(dbSchema.activityAdmission)
						.where(
							inArray(dbSchema.activityAdmission.runId, [
								seeded.ids.crashed,
							]),
						);
					return {
						seeded,
						runs,
						dismissals,
						leases,
					};
				}),
			),
		);
		const kept = new Map<ActivityRunId, Date | null>(
			runs.map((row) => [
				row.id,
				row.finishedSeenAt,
			]),
		);
		expect(
			[
				...kept.keys(),
			].sort(),
		).toEqual(
			[
				seeded.ids.recent,
				seeded.ids.running,
				seeded.ids.queued,
			].sort(),
		);
		expect(kept.get(seeded.ids.recent)).toBeInstanceOf(Date);
		expect(kept.get(seeded.ids.running)).toBeNull();
		expect(kept.get(seeded.ids.queued)).toBeNull();
		expect(dismissals.map((row) => row.occurrenceId)).toEqual([
			seeded.asset.processingFailureId as string,
		]);
		expect(leases).toEqual([]);
	},
	TIMEOUT,
);

/** Runs `effect` and collects the SQL statements it sends. */
const traced = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
	const statements: string[] = [];
	const tracer = Tracer.make({
		span(options) {
			const span = new Tracer.NativeSpan(options);
			const attribute = span.attribute.bind(span);
			span.attribute = (key, value) => {
				if (key === "db.query.text") statements.push(String(value));
				attribute(key, value);
			};
			return span;
		},
	});
	return effect.pipe(Effect.withTracer(tracer), Effect.as(statements));
};

test(
	"removes stale dismissals in batches and keeps those of current failures",
	async () => {
		const STALE = BATCH_SIZE * 2 + 500;
		const FAILED = 500;
		const { seeded, statements, kept } = await run(
			rolledBack(
				Effect.gen(function* () {
					const db = yield* DB;
					const user = yield* createUser();
					const failedAssets = (column: "processing" | "metadata") =>
						db
							.insert(dbSchema.asset)
							.values(
								Array.from(
									{
										length: FAILED,
									},
									(_, index) => ({
										bucket: "uploads" as const,
										prefix: `users/${user.id}/asset`,
										title: `Failed ${column} ${index}`,
										size: 1,
										fileType: "pdf" as const,
										userId: user.id,
										...(column === "processing"
											? {
													processingStatus: "failed" as const,
													processingFailureId: sql`gen_random_uuid()`,
												}
											: {
													metadataStatus: "failed" as const,
													metadataFailureId: sql`gen_random_uuid()`,
												}),
									}),
								),
							)
							.returning({
								id: dbSchema.asset.id,
								processingFailureId: dbSchema.asset.processingFailureId,
								metadataFailureId: dbSchema.asset.metadataFailureId,
							});
					const processing = yield* failedAssets("processing");
					const metadata = yield* failedAssets("metadata");
					const [block] = yield* db
						.insert(dbSchema.block)
						.values({
							type: "repository",
							name: "Cleanup repository",
							config: defaultRepositoryConfig,
							userId: user.id,
						})
						.returning();
					const links = yield* db
						.insert(dbSchema.blockAsset)
						.values(
							processing.map((row) => ({
								blockId: block.id,
								assetId: row.id,
								indexStatus: "failed" as const,
								indexFailureId: sql`gen_random_uuid()`,
							})),
						)
						.returning({
							failureId: dbSchema.blockAsset.indexFailureId,
						});
					const current = [
						...processing.map((row) => row.processingFailureId),
						...metadata.map((row) => row.metadataFailureId),
						...links.map((row) => row.failureId),
					] as string[];
					yield* db.insert(dbSchema.activityDismissal).values(
						[
							...current,
							...Array.from(
								{
									length: STALE,
								},
								() => crypto.randomUUID(),
							),
						].map((occurrenceId) => ({
							userId: user.id,
							occurrenceId,
						})),
					);
					const seeded = {
						user,
						current,
					};

					const statements = yield* traced(cleanupActivity);

					const kept = yield* db
						.select({
							occurrenceId: dbSchema.activityDismissal.occurrenceId,
						})
						.from(dbSchema.activityDismissal)
						.where(eq(dbSchema.activityDismissal.userId, user.id));
					return {
						seeded,
						statements,
						kept,
					};
				}),
			),
		);
		expect(kept.map((row) => row.occurrenceId).sort()).toEqual(
			[
				...seeded.current,
			].sort(),
		);
		const deletions = statements.filter((text) =>
			text.startsWith('delete from "activity_dismissal"'),
		);
		expect(deletions.length).toBeGreaterThanOrEqual(
			Math.ceil(STALE / BATCH_SIZE),
		);
		for (const text of deletions) expect(text).toContain(" limit ");
	},
	TIMEOUT,
);
