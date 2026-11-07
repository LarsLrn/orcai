import { type AssetId, buckets } from "@orcai/core";
import { DB, type DeletedData, dbSchema } from "@orcai/db";
import { assetObjectKey, processedAssetPrefix } from "@orcai/s3";
import {
	deletePrefixRecursively,
	sendDeleteObjectCommand,
} from "@orcai/s3/server";
import { asc, eq, lte } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { reconcileLinkPoints } from "./link-points";

/** A run holds a cleanup this long before the worker may take it over. */
const LEASE_MS = 5 * 60_000;
const DEADLINE_MS = LEASE_MS - 60_000;
const DRAIN_LIMIT = 100;
/**
 * Longer than an upload can be taken in: its signed URL lasts up to 30
 * minutes and storage expires a staged file after a day.
 */
const DELETED_ASSET_RETENTION_MS = 7 * 24 * 60 * 60_000;

const retryDelay = (attempt: number) =>
	Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));

/**
 * Removes the stored files and search points of deleted resources. Points go
 * through the link reconcile, so a point write still in flight lands first.
 * Every step is idempotent.
 */
const removeDeletedData = (data: DeletedData) =>
	Effect.all(
		[
			Effect.forEach(
				data.files,
				(asset) =>
					Effect.all([
						sendDeleteObjectCommand({
							bucket: asset.bucket,
							key: assetObjectKey(asset),
						}),
						deletePrefixRecursively({
							bucket: buckets.processed.name,
							prefix: processedAssetPrefix(asset.id),
						}),
					]),
				{
					concurrency: 5,
					discard: true,
				},
			),
			Effect.forEach(data.indexedLinks, reconcileLinkPoints, {
				concurrency: 5,
				discard: true,
			}),
		],
		{
			discard: true,
		},
	);

type DeletionCleanup = {
	readonly id: string;
	readonly data: DeletedData;
	readonly attempt: number;
};

/**
 * Records what a deletion leaves outside Postgres, in the transaction that
 * deletes it, and keeps deleted assets' ids from being used again. Pass the result to {@link cleanUpDeletions} after the commit;
 * should that run not finish, {@link cleanUpDueDeletions} retries it.
 */
export const recordDeletion = (data: DeletedData) =>
	Effect.gen(function* () {
		if (data.files.length === 0 && data.indexedLinks.length === 0)
			return undefined;
		const db = yield* DB;
		if (data.files.length > 0)
			yield* db
				.insert(dbSchema.deletedAsset)
				.values(
					data.files.map((file) => ({
						id: file.id,
					})),
				)
				.onConflictDoNothing();
		const [row] = yield* db
			.insert(dbSchema.deletionCleanup)
			.values({
				data,
				attempts: 1,
				nextAttemptAt: new Date(Date.now() + LEASE_MS),
			})
			.returning({
				id: dbSchema.deletionCleanup.id,
			});
		return {
			id: row.id,
			data,
			attempt: 1,
		} satisfies DeletionCleanup;
	});

/** Runs a claimed cleanup: done, its record goes; failed, it waits for a retry. */
const attemptCleanup = (cleanup: DeletionCleanup) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const result = yield* Effect.exit(
			removeDeletedData(cleanup.data).pipe(Effect.timeout(DEADLINE_MS)),
		);
		if (Exit.isSuccess(result)) {
			yield* db
				.delete(dbSchema.deletionCleanup)
				.where(eq(dbSchema.deletionCleanup.id, cleanup.id));
			return;
		}
		yield* db
			.update(dbSchema.deletionCleanup)
			.set({
				nextAttemptAt: new Date(Date.now() + retryDelay(cleanup.attempt)),
				lastError: Cause.pretty(result.cause).slice(0, 2000),
			})
			.where(eq(dbSchema.deletionCleanup.id, cleanup.id));
		yield* Effect.logWarning({
			operation: "deletion-cleanup.failed",
			cleanupId: cleanup.id,
			attempt: cleanup.attempt,
			cause: Cause.pretty(result.cause),
		});
	});

/**
 * Removes the external data of committed deletions. Never fails the caller:
 * whatever stays is retried by {@link cleanUpDueDeletions}.
 */
export const cleanUpDeletions = (
	cleanups: readonly (DeletionCleanup | undefined)[],
) =>
	Effect.forEach(
		cleanups.filter((cleanup) => cleanup !== undefined),
		(cleanup) =>
			attemptCleanup(cleanup).pipe(
				Effect.catch((cause) =>
					Effect.logWarning({
						operation: "deletion-cleanup.settle-failed",
						cleanupId: cleanup.id,
						cause,
					}),
				),
			),
		{
			discard: true,
		},
	);

/** Claims the cleanup due longest, extending its lease and counting the attempt. */
const claimDueCleanup = Effect.gen(function* () {
	const db = yield* DB;
	const now = new Date();
	return yield* db.transaction((tx) =>
		Effect.gen(function* () {
			const [row] = yield* tx
				.select()
				.from(dbSchema.deletionCleanup)
				.where(lte(dbSchema.deletionCleanup.nextAttemptAt, now))
				.orderBy(asc(dbSchema.deletionCleanup.nextAttemptAt))
				.limit(1)
				.for("update", {
					skipLocked: true,
				});
			if (!row) return undefined;
			const attempt = row.attempts + 1;
			yield* tx
				.update(dbSchema.deletionCleanup)
				.set({
					attempts: attempt,
					nextAttemptAt: new Date(now.getTime() + LEASE_MS),
				})
				.where(eq(dbSchema.deletionCleanup.id, row.id));
			return {
				id: row.id,
				data: row.data,
				attempt,
			} satisfies DeletionCleanup;
		}),
	);
});

/**
 * Whether the asset was deleted. The deletion records it in the transaction
 * that deletes the row, so a caller who found no row learns here whether one
 * existed.
 */
export const wasAssetDeleted = (id: AssetId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [deleted] = yield* db
			.select({
				id: dbSchema.deletedAsset.id,
			})
			.from(dbSchema.deletedAsset)
			.where(eq(dbSchema.deletedAsset.id, id));
		return deleted !== undefined;
	});

/**
 * Retries the cleanups whose run failed or never finished, and forgets
 * deleted assets' ids once no upload can use them. Each step is idempotent,
 * so a run overlapping another does no harm.
 */
export const cleanUpDueDeletions = Effect.gen(function* () {
	const db = yield* DB;
	yield* db
		.delete(dbSchema.deletedAsset)
		.where(
			lte(
				dbSchema.deletedAsset.deletedAt,
				new Date(Date.now() - DELETED_ASSET_RETENTION_MS),
			),
		);
	for (let run = 0; run < DRAIN_LIMIT; run++) {
		const cleanup = yield* claimDueCleanup;
		if (!cleanup) return;
		yield* attemptCleanup(cleanup);
	}
});
