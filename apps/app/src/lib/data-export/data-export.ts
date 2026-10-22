import { buckets, type DataExportId, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { sendJobBatch } from "@orcai/pg-boss";
import { dataExportKey } from "@orcai/s3";
import {
	DATA_EXPORT_JOB_NAME,
	type DataExport,
	type DataExportPayload,
	localeSchema,
} from "@orcai/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { uniqueViolationConstraint } from "@/lib/orpc/implementation/error-mapping";
import { withLocale } from "@/lib/presentation/with-locale";
import { type Transcript, writeDataExportContents } from "./archive-contents";
import { writeZipArchive } from "./zip-archive";

/** How long a ready archive can be downloaded; the bucket lifecycle deletes it after. */
export const DATA_EXPORT_TTL_MS = 24 * 60 * 60_000;

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
 * exports is in flight, and when queueing fails, which leaves this one failed.
 */
export const requestDataExport = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [created] = yield* db
			.insert(dbSchema.dataExport)
			.values({
				userId,
			})
			.returning()
			.pipe(
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

		yield* sendJobBatch<DataExportPayload>({
			jobName: DATA_EXPORT_JOB_NAME,
			jobs: [
				{
					data: {
						dataExportId: created.id,
					},
				},
			],
		}).pipe(
			Effect.tapError(() =>
				db
					.update(dbSchema.dataExport)
					.set({
						status: "failed",
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.dataExport.id, created.id)),
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
				transcript: (messages) =>
					withLocale(locale, () => transcript(messages)),
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
						accountUrl: `${config.auth.url}/app/account`,
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

/** Marks exports whose retries ran out as failed. */
export const failDataExports = (dataExportIds: readonly DataExportId[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* db
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
			);
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
