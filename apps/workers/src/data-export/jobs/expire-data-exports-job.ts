import { buckets } from "@orcai/core";
import type { Job } from "@orcai/pg-boss";
import { DATA_EXPORT_PREFIX, DATA_EXPORT_TTL_MS } from "@orcai/s3";
import { listObjects, sendDeleteObjectCommand } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

// A multipart upload's LastModified is when it started, up to an export attempt's
// hour before the export is ready.
const BUILD_GRACE_MS = 60 * 60_000;

/**
 * Deletes every object under `prefix` older than the download window and the
 * build grace, whatever its export row says: archives of deleted users and of
 * failed exports go too. Returns how many it deleted.
 */
export const expireDataExports = (
	params: { now?: Date; prefix?: string } = {},
) =>
	Effect.gen(function* () {
		const cutoff =
			(params.now ?? new Date()).getTime() -
			DATA_EXPORT_TTL_MS -
			BUILD_GRACE_MS;
		const objects = yield* listObjects({
			bucket: buckets.main.name,
			prefix: params.prefix ?? DATA_EXPORT_PREFIX,
		});
		const expired = objects.flatMap((object) =>
			object.Key &&
			(object.LastModified?.getTime() ?? Number.POSITIVE_INFINITY) <= cutoff
				? [
						object.Key,
					]
				: [],
		);

		// One archive that will not delete must not hold up the rest.
		const results = yield* Effect.forEach(
			expired,
			(key) =>
				sendDeleteObjectCommand({
					bucket: buckets.main.name,
					key,
				}).pipe(Effect.result),
			{
				concurrency: 10,
			},
		);
		const failures = results.flatMap((result) =>
			Result.isFailure(result)
				? [
						result.failure,
					]
				: [],
		);

		yield* Effect.logInfo(
			`data-export.expired count=${expired.length - failures.length} failed=${failures.length}`,
		);
		if (failures[0]) {
			return yield* Effect.fail(failures[0]);
		}
		return expired.length;
	});

export const expireDataExportsBatch = (_jobs: Job<unknown>[]) =>
	expireDataExports().pipe(Effect.asVoid);
