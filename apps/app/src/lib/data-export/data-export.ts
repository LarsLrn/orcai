import { buckets, type DataExportId, type UserId } from "@orcai/core";
import { DB, dbSchema, uniqueViolationConstraint } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { liveJobs, sendJobBatchInTransaction } from "@orcai/pg-boss";
import { inActivityRun } from "@orcai/preparation";
import { DATA_EXPORT_TTL_MS, dataExportKey } from "@orcai/s3";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	type DataExport,
	type DataExportPayload,
	localeSchema,
} from "@orcai/schema";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { withLocale } from "@/lib/locale/with-locale";
import { type Transcript, writeDataExportContents } from "./archive-contents";
import { writeZipArchive } from "./zip-archive";

type DataExportRow = typeof dbSchema.dataExport.$inferSelect;

const IN_FLIGHT: readonly DataExportRow["status"][] = [
	"pending",
	"processing",
];

const toDataExport = (row: DataExportRow, now = new Date()): DataExport => ({
	id: row.id,
	status:
		row.status === "ready" && row.expiresAt !== null && row.expiresAt <= now
			? "expired"
			: row.status,
	size: row.size,
	createdAt: row.createdAt,
	completedAt: row.completedAt,
	expiresAt: row.expiresAt,
});

/** The user's newest export, or undefined when they never requested one. */
export const findLatestDataExport = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select()
			.from(dbSchema.dataExport)
			.where(eq(dbSchema.dataExport.userId, userId))
			.orderBy(desc(dbSchema.dataExport.createdAt))
			.limit(1);
		return row && toDataExport(row);
	});

/**
 * Queues an export of everything the user owns. Fails while another of their
 * exports is in flight, and when queueing fails, which leaves no export.
 */
export const requestDataExport = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const created = yield* inActivityRun(
			{
				userId,
				kind: "export",
			},
			(runId) =>
				Effect.gen(function* () {
					const [row] = yield* db
						.insert(dbSchema.dataExport)
						.values({
							userId,
						})
						.returning();
					yield* db.insert(dbSchema.activityMember).values({
						runId,
						dataExportId: row.id,
					});
					yield* sendJobBatchInTransaction<DataExportPayload>({
						jobName: DATA_EXPORT_JOB_NAME,
						jobs: [
							{
								data: {
									dataExportId: row.id,
								},
							},
						],
					});
					return row;
				}),
		).pipe(
			Effect.catchIf(
				(error) =>
					uniqueViolationConstraint(error) ===
					"data_export_user_in_flight_unique",
				(cause) =>
					Effect.fail(
						new AppErrors.ConflictError({
							reason: "DATA_EXPORT_IN_PROGRESS",
							message: "An export of this user's data is already running",
							cause,
						}),
					),
			),
		);

		return toDataExport(created);
	});

/**
 * Builds the archive of an export in flight, marks it ready and emails its
 * owner. Runs again from the start after a failure; an export no longer in
 * flight is left alone.
 */
export const runDataExport = (
	dataExportId: DataExportId,
	transcript: Transcript,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { config } = yield* AppConfigService;
		const [target] = yield* db
			.select({
				status: dbSchema.dataExport.status,
				userId: dbSchema.user.id,
				email: dbSchema.user.email,
				name: dbSchema.user.name,
				locale: dbSchema.user.locale,
			})
			.from(dbSchema.dataExport)
			.innerJoin(
				dbSchema.user,
				eq(dbSchema.user.id, dbSchema.dataExport.userId),
			)
			.where(eq(dbSchema.dataExport.id, dataExportId));

		if (!target || !IN_FLIGHT.includes(target.status)) {
			return;
		}

		const [claimed] = yield* db
			.update(dbSchema.dataExport)
			.set({
				status: "processing",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(dbSchema.dataExport.id, dataExportId),
					inArray(dbSchema.dataExport.status, IN_FLIGHT),
				),
			)
			.returning({
				id: dbSchema.dataExport.id,
			});
		if (!claimed) {
			return;
		}

		const locale = localeSchema.catch("en").parse(target.locale);
		const size = yield* writeZipArchive(
			{
				bucket: buckets.main.name,
				key: dataExportKey({
					userId: target.userId,
					dataExportId,
				}),
			},
			writeDataExportContents({
				userId: target.userId,
				transcript: (messages, chat) =>
					withLocale(locale, () => transcript(messages, chat)),
			}),
		);

		const completedAt = new Date();
		const expiresAt = new Date(completedAt.getTime() + DATA_EXPORT_TTL_MS);
		yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const [ready] = yield* tx
					.update(dbSchema.dataExport)
					.set({
						status: "ready",
						size,
						completedAt,
						expiresAt,
						updatedAt: completedAt,
					})
					.where(
						and(
							eq(dbSchema.dataExport.id, dataExportId),
							inArray(dbSchema.dataExport.status, IN_FLIGHT),
						),
					)
					.returning({
						id: dbSchema.dataExport.id,
					});
				if (!ready) {
					return;
				}
				yield* enqueueNotification(
					{
						type: "data-export.ready",
						recipient: target.email,
						recipientName: target.name,
						accountUrl: `${config.auth.url}/app/account/data`,
						expiresAt,
						locale,
					},
					`data-export.ready:${dataExportId}`,
				);
			}),
		);
	}).pipe(
		Effect.withSpan("data-export.run", {
			attributes: {
				dataExportId,
			},
		}),
	);

/** Marks exports still in flight as failed and returns how many it failed. */
export const failDataExports = (dataExportIds: readonly DataExportId[]) =>
	Effect.gen(function* () {
		if (dataExportIds.length === 0) return 0;
		const db = yield* DB;
		const failed = yield* db
			.update(dbSchema.dataExport)
			.set({
				status: "failed",
				updatedAt: new Date(),
			})
			.where(
				and(
					inArray(dbSchema.dataExport.id, [
						...dataExportIds,
					]),
					inArray(dbSchema.dataExport.status, IN_FLIGHT),
				),
			)
			.returning({
				id: dbSchema.dataExport.id,
			});
		return failed.length;
	});

/** Exports in flight per batch of the sweep. */
const SWEEP_BATCH = 1000;

/**
 * The batch of exports in flight after `after` that no export or dead letter
 * job is left for: the dead letter handler failed too, or retention removed
 * the job. `next` is where the following batch starts, absent after the last.
 */
export const strandedDataExports = (
	after?: DataExportId,
	limit = SWEEP_BATCH,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		// Exports before jobs: an export is queued with its job, so a job of an export read here is live when the jobs are read.
		const rows = yield* db
			.select({
				id: dbSchema.dataExport.id,
			})
			.from(dbSchema.dataExport)
			.where(
				and(
					inArray(dbSchema.dataExport.status, IN_FLIGHT),
					after ? gt(dbSchema.dataExport.id, after) : undefined,
				),
			)
			.orderBy(asc(dbSchema.dataExport.id))
			.limit(limit);
		const ids = rows.map((row) => row.id);
		const jobs = yield* liveJobs<DataExportPayload>(
			[
				DATA_EXPORT_JOB_NAME,
				DATA_EXPORT_DEAD_LETTER_JOB_NAME,
			],
			{
				paths: [
					[
						"dataExportId",
					],
				],
				values: ids.map((id) => [
					id,
				]),
			},
		);
		const live = new Set(jobs.map((job) => job.data.dataExportId));
		return {
			stranded: ids.filter((id) => !live.has(id)),
			next: ids.length > 0 && ids.length === limit ? ids.at(-1) : undefined,
		};
	});

/**
 * Fails the exports in flight that no job will finish, batch by batch, so
 * their users can export again.
 */
export const sweepDataExports = Effect.gen(function* () {
	let after: DataExportId | undefined;
	let failed = 0;
	do {
		const batch: Effect.Success<ReturnType<typeof strandedDataExports>> =
			yield* strandedDataExports(after);
		failed += yield* failDataExports(batch.stranded);
		after = batch.next;
	} while (after);
	if (failed > 0) {
		yield* Effect.logWarning(
			{
				failed,
			},
			"Failed data exports no job will finish",
		);
	}
});

/** Where a ready, unexpired export of `userId` lives, or undefined. */
export const downloadableDataExport = (
	userId: UserId,
	dataExportId: DataExportId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select()
			.from(dbSchema.dataExport)
			.where(
				and(
					eq(dbSchema.dataExport.id, dataExportId),
					eq(dbSchema.dataExport.userId, userId),
				),
			);
		if (!row || toDataExport(row).status !== "ready") {
			return undefined;
		}
		return {
			bucket: buckets.main.name,
			key: dataExportKey({
				userId,
				dataExportId,
			}),
			completedAt: row.completedAt,
		};
	});
