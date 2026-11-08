import { expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService, runWorkers, TestClock } from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import { QdrantLive } from "@orcai/qdrant";
import { IsolatedEmbeddingIndexLive } from "@orcai/qdrant/testing";
import { S3Live } from "@orcai/s3/server";
import {
	defaultRepositoryConfig,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import { createUser, integrationRuntime } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import * as Scope from "effect/Scope";
import { assetWorkers } from "@/asset/definitions";

const TIMEOUT = 30_000;

const clock = new TestClock();
const runtime = integrationRuntime(
	IsolatedEmbeddingIndexLive().pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				S3Live,
				QdrantLive,
				EncryptionKeyLive,
				IsolatedPgBossLive({
					clock,
				}),
			),
		),
	),
);
const run = runtime.runPromise;
const boss = () => run(PgBossService.useSync(({ boss }) => boss));

/** A library asset being processed, linked to a repository that waits to index it. */
const seedLink = () =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [asset] = yield* db
				.insert(dbSchema.asset)
				.values({
					bucket: "uploads",
					prefix: `users/${user.id}/asset`,
					title: "Integration asset",
					size: 1,
					fileType: "pdf",
					userId: user.id,
					processingStatus: "pending",
				})
				.returning();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "repository",
					name: "Integration repository",
					config: defaultRepositoryConfig,
					userId: user.id,
				})
				.returning();
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: asset.id,
			});
			return {
				asset,
				blockId: block.id,
			};
		}),
	);

const stateOf = (link: Awaited<ReturnType<typeof seedLink>>) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const { asset, blockAsset } = dbSchema;
			const [processing] = yield* db
				.select({
					status: asset.processingStatus,
					generation: asset.processingGeneration,
					failure: asset.processingFailure,
				})
				.from(asset)
				.where(eq(asset.id, link.asset.id));
			const [indexing] = yield* db
				.select({
					status: blockAsset.indexStatus,
					attempt: blockAsset.indexAttempt,
					failure: blockAsset.indexFailure,
				})
				.from(blockAsset)
				.where(
					and(
						eq(blockAsset.assetId, link.asset.id),
						eq(blockAsset.blockId, link.blockId),
					),
				);
			return {
				processing,
				indexing,
			};
		}),
	);

const deadLetters = {
	[PROCESS_ASSET_JOB_NAME]: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	[VECTORIZE_ASSET_JOB_NAME]: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
} as const;

/** Works the stage queues and their dead letter queues with the asset workers until the test ends. */
const work = async () => {
	const queues = [
		...Object.keys(deadLetters),
		...Object.values(deadLetters),
	];
	const scope = await run(Scope.make());
	onTestFinished(() => run(Scope.close(scope, Exit.void)));
	await run(
		runWorkers<ManagedRuntime.ManagedRuntime.Services<typeof runtime>>(
			assetWorkers.filter((worker) => queues.includes(worker.queue)),
		).pipe(Scope.provide(scope)),
	);
};

/** Moves pg-boss's time on until `condition` holds. */
const until = async (condition: () => Promise<boolean>, what: string) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await clock.setTime(clock.now() + 10_000);
		await clock.tick(1);
		await sleep(10);
	}
};

test(
	"a payload queued before generations and attempts fails at once, through its dead letter queue, and leaves the current attempts alone",
	async () => {
		const pgBoss = await boss();
		const link = await seedLink();
		const before = await stateOf(link);
		await work();

		const sent = await Promise.all(
			(
				[
					[
						PROCESS_ASSET_JOB_NAME,
						{
							assetRef: {
								bucket: "uploads",
								prefix: link.asset.prefix,
								id: link.asset.id,
								type: "pdf",
							},
						},
					],
					[
						VECTORIZE_ASSET_JOB_NAME,
						{
							assetId: link.asset.id,
							blockId: link.blockId,
						},
					],
				] as const
			).map(async ([queue, data]) => ({
				queue,
				id: (await pgBoss.send(queue, data)) ?? "",
			})),
		);

		// The file's own pg-boss: each dead letter queue holds only this job's.
		const deadLettered = (job: (typeof sent)[number]) =>
			pgBoss.findJobs(deadLetters[job.queue]).then(([found]) => found);
		await until(
			async () =>
				(
					await Promise.all(
						sent.map(
							async (job) => (await deadLettered(job))?.state === "failed",
						),
					)
				).every(Boolean),
			"both dead letters to fail",
		);

		for (const job of sent) {
			expect(await pgBoss.getJobById(job.queue, job.id)).toMatchObject({
				state: "failed",
				retryCount: 0,
			});
			expect(await deadLettered(job)).toMatchObject({
				sourceId: job.id,
				state: "failed",
				retryCount: 0,
			});
		}
		expect(await stateOf(link)).toEqual(before);
	},
	TIMEOUT,
);
