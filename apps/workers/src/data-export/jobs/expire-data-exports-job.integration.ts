import { describe, expect, test } from "bun:test";
import { buckets } from "@orcai/core";
import { DATA_EXPORT_PREFIX, DATA_EXPORT_TTL_MS } from "@orcai/s3";
import { listObjects, S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { expireDataExports } from "./expire-data-exports-job";

const HOUR = 60 * 60_000;

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runPromise(effect);

const putArchives = (prefix: string, count: number) =>
	Effect.forEach(
		Array.from(
			{
				length: count,
			},
			(_, index) => `${prefix}${index}.zip`,
		),
		(key) =>
			sendPutObjectCommand({
				bucket: buckets.main.name,
				key,
				body: "archive",
				contentType: "application/zip",
			}),
		{
			concurrency: 20,
			discard: true,
		},
	);

const keysUnder = (prefix: string) =>
	listObjects({
		bucket: buckets.main.name,
		prefix,
	}).pipe(Effect.map((objects) => objects.map((object) => object.Key)));

const scopedPrefix = () => `${DATA_EXPORT_PREFIX}users/${crypto.randomUUID()}/`;

describe("expireDataExports", () => {
	test("deletes archives older than the download window and keeps newer ones", async () => {
		const prefix = scopedPrefix();
		const kept = await run(
			Effect.gen(function* () {
				yield* putArchives(prefix, 2);

				yield* expireDataExports({
					prefix,
					now: new Date(Date.now() + DATA_EXPORT_TTL_MS),
				});
				const youngerThanWindow = yield* keysUnder(prefix);

				yield* expireDataExports({
					prefix,
					now: new Date(Date.now() + DATA_EXPORT_TTL_MS + 2 * HOUR),
				});
				return {
					youngerThanWindow,
					olderThanWindow: yield* keysUnder(prefix),
				};
			}).pipe(Effect.provide(S3Live)),
		);

		expect(kept).toEqual({
			youngerThanWindow: [
				`${prefix}0.zip`,
				`${prefix}1.zip`,
			],
			olderThanWindow: [],
		});
	}, 30_000);

	test("sweeps a listing that spans several pages", async () => {
		const prefix = scopedPrefix();
		const outcome = await run(
			Effect.gen(function* () {
				yield* putArchives(prefix, 1_005);
				const deleted = yield* expireDataExports({
					prefix,
					now: new Date(Date.now() + DATA_EXPORT_TTL_MS + 2 * HOUR),
				});
				return {
					deleted,
					left: (yield* keysUnder(prefix)).length,
				};
			}).pipe(Effect.provide(S3Live)),
		);

		expect(outcome).toEqual({
			deleted: 1_005,
			left: 0,
		});
	}, 120_000);
});
