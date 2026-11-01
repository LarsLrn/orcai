import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import {
	type ActivityRunId,
	type AssetId,
	buckets,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	type Job,
	PgBoss,
	PgBossService,
	queueAfterProcessing,
	queueMetadataGeneration,
} from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import {
	type AssetMetadataType,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type MetadataGenerationMode,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
} from "@orcai/schema";
import {
	awaitLockWaiters,
	createJobQueues,
	IntegrationLive,
} from "@orcai/testing";
import { and, eq, like } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Tracer from "effect/Tracer";
import { generateMetadataBatch } from "@/asset/jobs/generate-metadata-job";
import {
	jsonAnswer,
	requests,
	seedImageAsset,
	suggestion,
} from "@/asset/test-vision";

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
		EncryptionKeyLive,
		Layer.succeed(PgBossService, {
			boss,
		}),
	),
);

beforeAll(async () => {
	await boss.start();
	await createJobQueues(boss);
}, TIMEOUT);
afterAll(async () => {
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
});

const documentAnswer = {
	title: "Refund policy 2026",
	sourceType: "journal-article",
	author: "Ada Lovelace",
	chapterTitle: null,
	journalName: "Journal of Policy",
	volume: "4",
	issueNumber: "2",
	pageRange: "1-9",
	doi: null,
	websiteName: null,
	externalUrl: null,
	accessDate: null,
	legalReference: null,
	jurisdiction: null,
	citationLabel:
		"Lovelace, A. (2026). Refund policy. Journal of Policy, 4(2), 1-9.",
	description: "How and when refunds are paid.",
	language: "en",
};

beforeEach(() => {
	requests.length = 0;
	jsonAnswer.value = documentAnswer;
	jsonAnswer.cutOff = false;
});

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

const storeExtraction = (
	assetId: AssetId,
	artifact: StoredExtractionArtifact,
	content = "Refund policy\n\nRefunds are paid within 14 days.",
) =>
	sendPutObjectCommand({
		bucket: buckets.processed.name,
		key: buildStoredExtractionKey(assetId),
		body: Buffer.from(
			serializeStoredExtractionArtifact({
				...artifact,
				content,
				images: [],
			}),
		),
		contentType: "application/json",
	});

/** A processed library document whose title is still the uploaded file's name. */
const seedAsset = async (
	params: {
		pool?: boolean;
		budget?: number;
		capabilities?: ("text" | "image")[];
		fileName?: string | null;
		metadata?: AssetMetadataType;
		content?: string;
		/** False leaves the processed document without its stored extraction. */
		stored?: boolean;
	} = {},
) => {
	const seeded = await run(
		seedImageAsset({
			capabilities: params.capabilities ?? [
				"text",
			],
			pool: params.pool,
			budget: params.budget,
		}),
	);
	const fileName =
		params.fileName === undefined ? "refunds.pdf" : params.fileName;
	await run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					fileType: "pdf",
					title: "refunds.pdf",
					fileName,
					metadata: params.metadata ?? {},
					processingStatus: "completed",
				})
				.where(eq(dbSchema.asset.id, seeded.assetId));
			if (params.stored !== false) {
				yield* storeExtraction(seeded.assetId, seeded.artifact, params.content);
			}
		}),
	);
	return seeded;
};

/** Admits a generation and returns its job as a worker would receive it. */
const admit = async (
	assetId: AssetId,
	mode: MetadataGenerationMode,
	userId?: UserId,
) => {
	const admitted = await run(
		queueMetadataGeneration({
			assetIds: [
				assetId,
			],
			mode,
			userId,
		}),
	);
	const [job] = await boss.findJobs<GenerateAssetMetadataPayload>(
		GENERATE_ASSET_METADATA_JOB_NAME,
		{
			data: {
				assetId,
			},
			queued: true,
		},
	);
	return {
		admitted,
		job: job as Job<GenerateAssetMetadataPayload> | undefined,
	};
};

const latestJob = async (assetId: AssetId) => {
	const jobs = await boss.findJobs<GenerateAssetMetadataPayload>(
		GENERATE_ASSET_METADATA_JOB_NAME,
		{
			data: {
				assetId,
			},
		},
	);
	return jobs
		.map((job) => job as Job<GenerateAssetMetadataPayload>)
		.sort((a, b) => b.data.generation - a.data.generation)[0];
};

/** A tracer that collects the SQL statements run under it. */
const statementTracer = (statements: string[]) =>
	Tracer.make({
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

const runJob = (job: Job<GenerateAssetMetadataPayload>) =>
	run(
		generateMetadataBatch([
			job,
		]),
	);

const assetOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					title: dbSchema.asset.title,
					metadata: dbSchema.asset.metadata,
					status: dbSchema.asset.metadataStatus,
					failure: dbSchema.asset.metadataFailure,
					suggestion: dbSchema.asset.metadataSuggestion,
					generation: dbSchema.asset.metadataGeneration,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row;
		}),
	);

const usageUsers = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					organizationId: dbSchema.quotaUsageEvent.organizationId,
					userId: dbSchema.quotaUsageEvent.userId,
				})
				.from(dbSchema.quotaUsageEvent)
				.where(
					and(
						like(
							dbSchema.quotaUsageEvent.appRequestId,
							`metadata:${assetId}:%`,
						),
						eq(dbSchema.quotaUsageEvent.eventType, "finalized"),
					),
				);
			return rows;
		}),
	);

test(
	"apply fills empty fields and the file-name title, metered against the asset's organisation and the user who asked",
	async () => {
		const seeded = await seedAsset({
			metadata: {
				author: "Kept Author",
			},
		});
		await admit(seeded.assetId, "apply", seeded.adminId);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		expect(await assetOf(seeded.assetId)).toMatchObject({
			title: "Refund policy 2026",
			metadata: {
				author: "Kept Author",
				sourceType: "journal-article",
				journalName: "Journal of Policy",
				citationLabel: documentAnswer.citationLabel,
				description: documentAnswer.description,
				language: "en",
			},
			status: "completed",
			suggestion: null,
		});
		expect(await usageUsers(seeded.assetId)).toEqual([
			{
				organizationId: seeded.organizationId,
				userId: seeded.adminId,
			},
		]);
	},
	TIMEOUT,
);

test(
	"apply keeps a value saved after the job was queued, and a title without a known file name",
	async () => {
		const seeded = await seedAsset({
			fileName: null,
		});
		await admit(seeded.assetId, "apply");
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						metadata: {
							journalName: "Saved by a person",
						},
					})
					.where(eq(dbSchema.asset.id, seeded.assetId));
			}),
		);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		const asset = await assetOf(seeded.assetId);
		expect(asset?.title).toBe("refunds.pdf");
		expect(asset?.metadata.journalName).toBe("Saved by a person");
		expect(asset?.metadata.description).toBe(documentAnswer.description);
	},
	TIMEOUT,
);

test(
	"apply keeps the fields of another source type for review",
	async () => {
		const seeded = await seedAsset({
			metadata: {
				sourceType: "book",
			},
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		const asset = await assetOf(seeded.assetId);
		expect(asset?.metadata).toEqual({
			sourceType: "book",
			description: documentAnswer.description,
			language: "en",
		});
		expect(asset?.suggestion?.metadata).toMatchObject({
			sourceType: "journal-article",
			journalName: "Journal of Policy",
		});
	},
	TIMEOUT,
);

test(
	"review keeps the whole suggestion and applies nothing",
	async () => {
		const seeded = await seedAsset();
		await admit(seeded.assetId, "review", seeded.adminId);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		const asset = await assetOf(seeded.assetId);
		expect(asset?.title).toBe("refunds.pdf");
		expect(asset?.metadata).toEqual({});
		expect(asset?.suggestion).toMatchObject({
			title: "Refund policy 2026",
			metadata: {
				journalName: "Journal of Policy",
			},
		});
	},
	TIMEOUT,
);

test(
	"a second apply while one runs is not admitted; a review supersedes it, and the first job's result is dropped",
	async () => {
		const seeded = await seedAsset();
		const first = await admit(seeded.assetId, "apply");
		const second = await admit(seeded.assetId, "apply");
		expect(first.admitted).toEqual([
			seeded.assetId,
		]);
		expect(second.admitted).toEqual([]);
		const stale = await latestJob(seeded.assetId);
		if (!stale) throw new Error("No job queued");

		await admit(seeded.assetId, "review");
		await runJob(stale);

		const asset = await assetOf(seeded.assetId);
		expect(asset?.status).toBe("pending");
		expect(asset?.title).toBe("refunds.pdf");
		expect(requests).toHaveLength(0);
	},
	TIMEOUT,
);

test(
	"a delivery replayed after its run completed calls nothing and changes nothing",
	async () => {
		const seeded = await seedAsset();
		await admit(seeded.assetId, "review");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");
		await runJob(job);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						metadataSuggestion: null,
					})
					.where(eq(dbSchema.asset.id, seeded.assetId));
			}),
		);
		const before = await assetOf(seeded.assetId);
		requests.length = 0;

		await runJob(job);

		expect(requests).toHaveLength(0);
		expect(await assetOf(seeded.assetId)).toEqual(before);
		expect(before).toMatchObject({
			status: "completed",
			suggestion: null,
		});
	},
	TIMEOUT,
);

test(
	"the quota reservation counts the document, so a pool that covers only the reply refuses",
	async () => {
		const seeded = await seedAsset({
			budget: 2_000,
			content: "Refunds are paid within 14 days. ".repeat(1_000),
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		expect(requests).toHaveLength(0);
		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "failed",
			failure: "quota",
		});
	},
	TIMEOUT,
);

test(
	"simultaneous apply triggers admit one generation",
	async () => {
		const seeded = await seedAsset();

		const results = await Promise.all(
			[
				1,
				2,
				3,
			].map(() =>
				run(
					queueMetadataGeneration({
						assetIds: [
							seeded.assetId,
						],
						mode: "apply",
					}),
				),
			),
		);

		expect(results.flat()).toEqual([
			seeded.assetId,
		]);
		expect((await assetOf(seeded.assetId))?.generation).toBe(1);
	},
	TIMEOUT,
);

test(
	"a refused quota fails with quota, and only an asset with a utility model is admitted",
	async () => {
		const seeded = await seedAsset({
			pool: false,
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "failed",
			failure: "quota",
		});

		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.organization)
					.set({
						utilityModelId: null,
					})
					.where(eq(dbSchema.organization.id, seeded.organizationId));
			}),
		);
		expect((await admit(seeded.assetId, "review")).admitted).toEqual([]);
	},
	TIMEOUT,
);

test(
	"an image asset applies what processing suggested without another call",
	async () => {
		const seeded = await run(
			seedImageAsset({
				capabilities: [
					"text",
					"image",
				],
			}),
		);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						fileName: "chart.png",
						processingStatus: "completed",
					})
					.where(eq(dbSchema.asset.id, seeded.assetId));
				const artifact: StoredExtractionArtifact = {
					...seeded.artifact,
					images: seeded.artifact.images.map((image) => ({
						...image,
						text: suggestion.text,
					})),
					metadataSuggestion: {
						title: suggestion.title,
						description: suggestion.description,
						language: suggestion.language,
					},
				};
				yield* sendPutObjectCommand({
					bucket: buckets.processed.name,
					key: buildStoredExtractionKey(seeded.assetId),
					body: Buffer.from(serializeStoredExtractionArtifact(artifact)),
					contentType: "application/json",
				});
			}),
		);
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		expect(await assetOf(seeded.assetId)).toMatchObject({
			title: suggestion.title,
			metadata: {
				description: suggestion.description,
				language: "en",
			},
			status: "completed",
		});
		expect(requests).toHaveLength(0);
	},
	TIMEOUT,
);

test(
	"apply storing while its member's repository is deleted deadlocks, and the victim runs again without a second model call",
	async () => {
		const seeded = await seedAsset();
		const { blockId, runId } = await run(
			Effect.gen(function* () {
				const db = yield* DB;
				const [block] = yield* db
					.insert(dbSchema.block)
					.values({
						type: "repository",
						name: "Deleted repository",
						config: {},
						userId: seeded.adminId,
					})
					.returning({
						id: dbSchema.block.id,
					});
				const [activityRun] = yield* db
					.insert(dbSchema.activityRun)
					.values({
						userId: seeded.adminId,
						kind: "upload",
						organizationId: seeded.organizationId,
					})
					.returning({
						id: dbSchema.activityRun.id,
					});
				if (!block || !activityRun) throw new Error("Nothing seeded");
				yield* db.insert(dbSchema.activityMember).values({
					runId: activityRun.id,
					assetId: seeded.assetId,
					blockId: block.id,
				});
				return {
					blockId: block.id,
					runId: activityRun.id,
				};
			}),
		);
		await run(
			queueMetadataGeneration({
				assetIds: [
					seeded.assetId,
				],
				mode: "apply",
				onlyMissing: true,
				userId: seeded.adminId,
				runId,
			}),
		);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		// Deletion holds the repository; its cascade then needs the member the store holds.
		const locked = await run(Deferred.make<void>());
		const go = await run(Deferred.make<void>());
		let deletions = 0;
		const deletion = await run(
			Effect.forkDetach(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* retryDeadlocks(
						db.transaction(() =>
							Effect.gen(function* () {
								deletions += 1;
								yield* db
									.select({
										id: dbSchema.block.id,
									})
									.from(dbSchema.block)
									.where(eq(dbSchema.block.id, blockId))
									.for("update");
								yield* Deferred.succeed(locked, undefined);
								yield* Deferred.await(go);
								yield* db
									.delete(dbSchema.block)
									.where(eq(dbSchema.block.id, blockId));
							}),
						),
					);
				}),
			),
		);
		await run(Deferred.await(locked));
		const statements: string[] = [];
		const store = await run(
			Effect.forkDetach(
				generateMetadataBatch([
					job,
				]).pipe(Effect.withTracer(statementTracer(statements))),
			),
		);
		// The member's second change in the store rechecks its repository's key.
		await run(awaitLockWaiters("%applied_fields%"));
		await run(Deferred.succeed(go, undefined));
		await run(Fiber.join(store));
		await run(Fiber.join(deletion));

		const stores = statements.filter((text) =>
			text.startsWith('select "title", "file_name", "metadata" from "asset"'),
		).length;
		expect(stores > 1 || deletions > 1).toBe(true);
		expect(requests).toHaveLength(1);
		expect(await assetOf(seeded.assetId)).toMatchObject({
			title: "Refund policy 2026",
			status: "completed",
		});
		const [member] = await run(
			Effect.gen(function* () {
				return yield* (yield* DB)
					.select({
						blockId: dbSchema.activityMember.blockId,
						metadata: dbSchema.activityMember.metadataState,
					})
					.from(dbSchema.activityMember)
					.where(eq(dbSchema.activityMember.runId, runId));
			}),
		);
		expect(member).toEqual({
			blockId: null,
			metadata: "completed",
		});
	},
	TIMEOUT,
);

const processJobs = (assetId: AssetId) =>
	boss.findJobs<ProcessAssetPayload>(PROCESS_ASSET_JOB_NAME, {
		data: {
			assetRef: {
				id: assetId,
			},
		},
	});

const metadataJobs = (assetId: AssetId) =>
	boss.findJobs<GenerateAssetMetadataPayload>(
		GENERATE_ASSET_METADATA_JOB_NAME,
		{
			data: {
				assetId,
			},
		},
	);

const processingOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.asset.processingStatus,
					generation: dbSchema.asset.processingGeneration,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row;
		}),
	);

const setProcessing = (assetId: AssetId, status: "completed" | "failed") =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					processingStatus: status,
				})
				.where(eq(dbSchema.asset.id, assetId));
		}),
	);

/** What the processing job does once the file is prepared: completes it and queues what follows. */
const completeProcessing = (
	seeded: Awaited<ReturnType<typeof seedAsset>>,
	runId?: ActivityRunId,
) =>
	run(
		Effect.gen(function* () {
			yield* storeExtraction(seeded.assetId, seeded.artifact);
			const db = yield* DB;
			yield* db.transaction(() =>
				Effect.gen(function* () {
					yield* db
						.update(dbSchema.asset)
						.set({
							processingStatus: "completed",
						})
						.where(eq(dbSchema.asset.id, seeded.assetId));
					yield* queueAfterProcessing({
						assetId: seeded.assetId,
						runId,
					});
				}),
			);
		}),
	);

const memberOf = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const [member] = yield* (yield* DB)
				.select({
					processing: dbSchema.activityMember.processingState,
					metadata: dbSchema.activityMember.metadataState,
				})
				.from(dbSchema.activityMember)
				.where(eq(dbSchema.activityMember.runId, runId));
			return member;
		}),
	);

test(
	"a missing extraction prepares the file again as the run's work, and the review resumes once it is prepared",
	async () => {
		const seeded = await seedAsset({
			stored: false,
		});
		const runId = await run(
			Effect.gen(function* () {
				const [activityRun] = yield* (yield* DB)
					.insert(dbSchema.activityRun)
					.values({
						userId: seeded.adminId,
						kind: "suggest_metadata",
						organizationId: seeded.organizationId,
					})
					.returning({
						id: dbSchema.activityRun.id,
					});
				if (!activityRun) throw new Error("No run seeded");
				return activityRun.id;
			}),
		);
		await run(
			queueMetadataGeneration({
				assetIds: [
					seeded.assetId,
				],
				mode: "review",
				userId: seeded.adminId,
				runId,
			}),
		);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		const next = await latestJob(seeded.assetId);
		expect(requests).toHaveLength(0);
		expect(await processingOf(seeded.assetId)).toEqual({
			status: "pending",
			generation: 1,
		});
		const [preparation] = await processJobs(seeded.assetId);
		expect(preparation?.data).toMatchObject({
			generation: 1,
			runId,
		});
		expect(next?.data).toEqual({
			...job.data,
			generation: job.data.generation + 1,
			preparedAgain: true,
		});
		const handedOn = (await metadataJobs(seeded.assetId)).find(
			(queued) => queued.id === next?.id,
		);
		expect(handedOn?.startAfter.getTime()).toBeGreaterThan(Date.now());
		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "pending",
			generation: job.data.generation + 1,
		});
		expect(await memberOf(runId)).toEqual({
			processing: "pending",
			metadata: "pending",
		});

		// A duplicate delivery finds its generation replaced.
		await runJob(job);
		expect(await processJobs(seeded.assetId)).toHaveLength(1);
		expect(await metadataJobs(seeded.assetId)).toHaveLength(2);

		await completeProcessing(seeded, runId);
		expect(await metadataJobs(seeded.assetId)).toHaveLength(2);
		if (!next) throw new Error("No job handed on");
		await runJob(next);

		expect(requests).toHaveLength(1);
		expect(await assetOf(seeded.assetId)).toMatchObject({
			title: "refunds.pdf",
			status: "completed",
			suggestion: {
				title: "Refund policy 2026",
			},
		});
		expect(await memberOf(runId)).toEqual({
			processing: "completed",
			metadata: "completed",
		});
	},
	TIMEOUT,
);

test(
	"a generation that finds its file still being prepared waits again without preparing it twice",
	async () => {
		const seeded = await seedAsset({
			stored: false,
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");
		await runJob(job);
		const waiting = await latestJob(seeded.assetId);
		if (!waiting) throw new Error("No job handed on");

		await runJob(waiting);

		expect(await processJobs(seeded.assetId)).toHaveLength(1);
		expect((await latestJob(seeded.assetId))?.data).toEqual({
			...job.data,
			generation: job.data.generation + 2,
			preparedAgain: true,
		});
		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "pending",
			failure: null,
		});
		expect(requests).toHaveLength(0);
	},
	TIMEOUT,
);

test(
	"an extraction still missing after the file was prepared again fails as missing",
	async () => {
		const seeded = await seedAsset({
			stored: false,
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");
		await runJob(job);
		const waiting = await latestJob(seeded.assetId);
		if (!waiting) throw new Error("No job handed on");
		await setProcessing(seeded.assetId, "completed");

		await runJob(waiting);

		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "failed",
			failure: "missing_extraction",
		});
		expect(await processJobs(seeded.assetId)).toHaveLength(1);
		expect(requests).toHaveLength(0);
	},
	TIMEOUT,
);

test(
	"a waiting generation fails as missing when preparing the file again failed",
	async () => {
		const seeded = await seedAsset({
			stored: false,
		});
		await admit(seeded.assetId, "apply");
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");
		await runJob(job);
		const waiting = await latestJob(seeded.assetId);
		if (!waiting) throw new Error("No job handed on");
		await setProcessing(seeded.assetId, "failed");

		await runJob(waiting);

		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "failed",
			failure: "missing_extraction",
		});
		expect(await processJobs(seeded.assetId)).toHaveLength(1);
	},
	TIMEOUT,
);

test(
	"a delivery of a replaced generation neither prepares the file nor waits",
	async () => {
		const seeded = await seedAsset({
			stored: false,
		});
		await admit(seeded.assetId, "apply");
		const stale = await latestJob(seeded.assetId);
		if (!stale) throw new Error("No job queued");
		await admit(seeded.assetId, "review");

		await runJob(stale);

		expect(await processJobs(seeded.assetId)).toHaveLength(0);
		expect(await metadataJobs(seeded.assetId)).toHaveLength(2);
		expect(await processingOf(seeded.assetId)).toEqual({
			status: "completed",
			generation: 0,
		});
	},
	TIMEOUT,
);

test(
	"an answer cut off at its output budget is charged and fails as cut off without a retry",
	async () => {
		const seeded = await seedAsset();
		jsonAnswer.cutOff = true;
		await admit(seeded.assetId, "apply", seeded.adminId);
		const job = await latestJob(seeded.assetId);
		if (!job) throw new Error("No job queued");

		await runJob(job);

		expect(requests).toHaveLength(1);
		expect(await assetOf(seeded.assetId)).toMatchObject({
			status: "failed",
			failure: "output_limit",
		});
		expect(await usageUsers(seeded.assetId)).toHaveLength(1);
	},
	TIMEOUT,
);

for (const preparedAgain of [
	false,
	true,
]) {
	test(
		`an extraction stored between the missing read and the asset lock is used${preparedAgain ? " after the file was prepared again" : ""}`,
		async () => {
			const seeded = await seedAsset({
				stored: false,
			});
			await admit(seeded.assetId, "review");
			const admitted = await latestJob(seeded.assetId);
			if (!admitted) throw new Error("No job queued");
			const job = preparedAgain
				? {
						...admitted,
						data: {
							...admitted.data,
							preparedAgain: true as const,
						},
					}
				: admitted;

			// A key share lets the claim update the asset but holds the recovery's lock.
			const locked = await run(Deferred.make<void>());
			const go = await run(Deferred.make<void>());
			const holder = await run(
				Effect.forkDetach(
					Effect.gen(function* () {
						const db = yield* DB;
						yield* db.transaction(() =>
							Effect.gen(function* () {
								yield* db
									.select({
										id: dbSchema.asset.id,
									})
									.from(dbSchema.asset)
									.where(eq(dbSchema.asset.id, seeded.assetId))
									.for("key share");
								yield* Deferred.succeed(locked, undefined);
								yield* Deferred.await(go);
							}),
						);
					}),
				),
			);
			await run(Deferred.await(locked));
			const worker = await run(
				Effect.forkDetach(
					generateMetadataBatch([
						job,
					]),
				),
			);
			await run(awaitLockWaiters('%"processing_generation" from "asset"%'));
			await run(storeExtraction(seeded.assetId, seeded.artifact));
			await run(Deferred.succeed(go, undefined));
			await run(Fiber.join(holder));
			await run(Fiber.join(worker));

			expect(await processJobs(seeded.assetId)).toHaveLength(0);
			expect(requests).toHaveLength(1);
			expect(await assetOf(seeded.assetId)).toMatchObject({
				status: "completed",
				generation: job.data.generation,
				suggestion: {
					title: "Refund policy 2026",
				},
			});
		},
		TIMEOUT,
	);
}
