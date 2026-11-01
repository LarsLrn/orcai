import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ActivityRunId, type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	admitStage,
	PgBoss,
	PgBossService,
	sendJobBatchInTransaction,
} from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	createImageOnlyStoredExtractionArtifact,
	type StoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import {
	type JobQueue,
	type PipelineStatus,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
} from "@orcai/schema";
import {
	awaitLockWaiters,
	createJobQueues,
	createUser,
	IntegrationLive,
} from "@orcai/testing";
import { and, eq, sql } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { describedExtraction } from "@/asset/described-extraction";
import {
	AssetPipelineError,
	claimProcessing,
	type IndexingAttempt,
	processingAttempt,
	settleProcessingAttempt,
} from "@/asset/pipeline-attempt";

const TIMEOUT = 30_000;

const boss = new PgBoss({
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
});
boss.on("error", () => undefined);

const runtime = ManagedRuntime.make(
	Layer.mergeAll(
		IntegrationLive,
		S3Live,
		Layer.succeed(PgBossService, {
			boss,
		}),
	),
);

const TEST_QUEUE = `test-described-extraction-${crypto.randomUUID()}`;

beforeAll(async () => {
	await boss.start();
	await createJobQueues(boss);
	await boss.createQueue(TEST_QUEUE);
}, TIMEOUT);
afterAll(async () => {
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
});

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

const olderExtraction = (prefix: string, assetId: AssetId) =>
	createImageOnlyStoredExtractionArtifact({
		mimeType: "image/png",
		format: "png",
		sourceBucket: buckets.main.name,
		sourcePath: `${prefix}/${assetId}.png`,
	});

const described = (
	extraction: StoredExtractionArtifact,
): StoredExtractionArtifact => ({
	...extraction,
	images: extraction.images.map((image) => ({
		...image,
		text: "A bar chart of refunds.",
	})),
});

const storeExtraction = (
	assetId: AssetId,
	extraction: StoredExtractionArtifact,
) =>
	sendPutObjectCommand({
		bucket: buckets.processed.name,
		key: buildStoredExtractionKey(assetId),
		body: Buffer.from(serializeStoredExtractionArtifact(extraction)),
		contentType: "application/json",
	});

/** An image asset in two repositories, its extraction stored without a description. */
const seed = (processingStatus: PipelineStatus = "completed") =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [asset] = yield* db
				.insert(dbSchema.asset)
				.values({
					bucket: buckets.main.name,
					prefix: `users/${user.id}/asset`,
					title: "chart.png",
					size: 1,
					fileType: "png",
					userId: user.id,
					processingStatus,
				})
				.returning();
			const blocks = yield* db
				.insert(dbSchema.block)
				.values(
					[
						"First",
						"Second",
					].map((name) => ({
						type: "repository" as const,
						name: `${name} repository`,
						config: {},
						userId: user.id,
					})),
				)
				.returning();
			const links = yield* db
				.insert(dbSchema.blockAsset)
				.values(
					blocks.map((block) => ({
						blockId: block.id,
						assetId: asset.id,
						indexStatus: "active" as const,
					})),
				)
				.returning();
			const extraction = olderExtraction(asset.prefix, asset.id);
			yield* storeExtraction(asset.id, extraction);
			return {
				userId: user.id,
				asset: {
					id: asset.id,
					bucket: asset.bucket,
					prefix: asset.prefix,
					fileType: asset.fileType,
				},
				attempts: links.map(
					(link): IndexingAttempt => ({
						assetId: link.assetId,
						blockId: link.blockId,
						attempt: link.indexAttempt,
					}),
				),
				extraction,
			};
		}),
	);

const queued = async (assetId: AssetId) =>
	(
		await boss.findJobs(PROCESS_ASSET_JOB_NAME, {
			data: {
				assetRef: {
					id: assetId,
				},
			},
		})
	).length;

const stateOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [asset] = yield* db
				.select({
					status: dbSchema.asset.processingStatus,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			const links = yield* db
				.select({
					status: dbSchema.blockAsset.indexStatus,
					attempt: dbSchema.blockAsset.indexAttempt,
				})
				.from(dbSchema.blockAsset)
				.where(eq(dbSchema.blockAsset.assetId, assetId));
			return {
				asset: asset?.status,
				links: links.map((link) => link.status).sort(),
				attempts: links.map((link) => link.attempt),
			};
		}),
	);

test(
	"two repositories reading an older extraction at once queue processing once",
	async () => {
		const { asset, attempts } = await seed();

		const results = await Promise.all(
			attempts.map((attempt) =>
				run(
					describedExtraction({
						jobId: crypto.randomUUID(),
						asset,
						attempt,
					}),
				),
			),
		);

		expect(results).toEqual([
			undefined,
			undefined,
		]);
		expect(await queued(asset.id)).toBe(1);
		const after = await stateOf(asset.id);
		expect(after).toMatchObject({
			asset: "pending",
			links: [
				"pending",
				"pending",
			],
		});
		// Processing queues indexing again as new attempts; the waiting ones are replaced.
		for (const { attempt } of attempts) {
			expect(after.attempts).not.toContain(attempt);
		}
	},
	TIMEOUT,
);

test(
	"a reader whose extraction went stale while processing finished indexes the described one",
	async () => {
		const { asset, attempts, extraction } = await seed();
		const locked = await run(Deferred.make<void>());
		const release = await run(Deferred.make<void>());

		// Processing stores the extraction, then marks the asset completed, holding its row.
		const processing = runtime.runFork(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.transaction(() =>
					Effect.gen(function* () {
						yield* db
							.select({
								id: dbSchema.asset.id,
							})
							.from(dbSchema.asset)
							.where(eq(dbSchema.asset.id, asset.id))
							.for("update");
						yield* Deferred.succeed(locked, undefined);
						yield* Deferred.await(release);
						yield* storeExtraction(asset.id, described(extraction));
					}),
				);
			}),
		);
		await run(Deferred.await(locked));

		const reader = run(
			describedExtraction({
				jobId: crypto.randomUUID(),
				asset,
				attempt: attempts[0],
			}),
		);
		// The reader has read the older extraction and waits for the row.
		await run(awaitLockWaiters('%from "asset"%for update%'));
		await run(Deferred.succeed(release, undefined));
		await run(Fiber.join(processing));

		expect((await reader)?.images[0]?.text).toBe("A bar chart of refunds.");
		expect(await queued(asset.id)).toBe(0);
		expect((await stateOf(asset.id)).asset).toBe("completed");
	},
	TIMEOUT,
);

test(
	"a reader while processing runs queues nothing and waits for indexing to be queued again",
	async () => {
		const { asset, attempts } = await seed("active");

		expect(
			await run(
				describedExtraction({
					jobId: crypto.randomUUID(),
					asset,
					attempt: attempts[0],
				}),
			),
		).toBeUndefined();
		expect(await queued(asset.id)).toBe(0);
		expect(await stateOf(asset.id)).toMatchObject({
			asset: "active",
			links: [
				"active",
				"pending",
			],
		});
	},
	TIMEOUT,
);

test(
	"a replaced attempt reading an older extraction queues no processing",
	async () => {
		const { asset, attempts } = await seed();
		const [replaced] = attempts;
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "pending",
						indexAttempt: sql`nextval('block_asset_index_attempt_seq')`,
					})
					.where(
						and(
							eq(dbSchema.blockAsset.assetId, replaced.assetId),
							eq(dbSchema.blockAsset.blockId, replaced.blockId),
						),
					);
			}),
		);

		expect(
			await run(
				describedExtraction({
					jobId: crypto.randomUUID(),
					asset,
					attempt: replaced,
				}),
			),
		).toBeUndefined();
		expect(await queued(asset.id)).toBe(0);
		expect(await stateOf(asset.id)).toMatchObject({
			asset: "completed",
			links: [
				"active",
				"pending",
			],
		});
	},
	TIMEOUT,
);

test(
	"a job sent in a transaction is queued only if it commits",
	async () => {
		const send = (marker: string, outcome: Effect.Effect<void, string>) =>
			run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db.transaction(() =>
						sendJobBatchInTransaction({
							jobName: TEST_QUEUE as JobQueue,
							jobs: [
								{
									data: {
										marker,
									},
								},
							],
						}).pipe(Effect.andThen(outcome)),
					);
				}).pipe(Effect.ignore),
			);
		const queuedWith = async (marker: string) =>
			(
				await boss.findJobs(TEST_QUEUE, {
					data: {
						marker,
					},
				})
			).length;
		const committed = crypto.randomUUID();
		const rolledBack = crypto.randomUUID();

		await send(committed, Effect.void);
		await send(rolledBack, Effect.fail("crash after the send"));

		expect(await queuedWith(committed)).toBe(1);
		expect(await queuedWith(rolledBack)).toBe(0);
	},
	TIMEOUT,
);

/** The run's member of the asset, as its processing and indexing stages stand. */
const memberStages = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const [member] = yield* (yield* DB)
				.select({
					processing: dbSchema.activityMember.processingState,
					indexing: dbSchema.activityMember.indexingState,
				})
				.from(dbSchema.activityMember)
				.where(eq(dbSchema.activityMember.runId, runId));
			return member;
		}),
	);

test(
	"a run's indexing that goes back to processing is replaced, so a failed processing finishes the run",
	async () => {
		const { userId, asset, attempts } = await seed();
		const [attempt] = attempts;
		const runId = await run(
			Effect.gen(function* () {
				const [created] = yield* (yield* DB)
					.insert(dbSchema.activityRun)
					.values({
						userId,
						kind: "retry",
					})
					.returning({
						id: dbSchema.activityRun.id,
					});
				yield* admitStage(created.id, [
					{
						stage: "indexing",
						assetId: attempt.assetId,
						blockId: attempt.blockId,
					},
				]);
				return created.id;
			}),
		);

		await run(
			describedExtraction({
				jobId: crypto.randomUUID(),
				asset,
				attempt: {
					...attempt,
					runId,
				},
			}),
		);
		expect(await memberStages(runId)).toEqual({
			processing: "pending",
			indexing: "replaced",
		});

		const [job] = await boss.findJobs<ProcessAssetPayload>(
			PROCESS_ASSET_JOB_NAME,
			{
				data: {
					assetRef: {
						id: asset.id,
					},
				},
			},
		);
		const processing = processingAttempt(job.data);
		expect(processing.runId).toBe(runId);
		expect(await run(claimProcessing(processing))).toBe(true);
		await run(
			settleProcessingAttempt(
				processing,
				Effect.fail(
					new AssetPipelineError({
						failure: "unsupported",
						cause: "no text",
					}),
				),
			),
		);

		expect(await memberStages(runId)).toEqual({
			processing: "failed",
			indexing: "replaced",
		});
	},
	TIMEOUT,
);
