import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, buckets, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type Job,
	PgBoss,
	PgBossService,
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
} from "@orcai/schema";
import { IntegrationLive } from "@orcai/testing";
import { and, eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
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
	await boss.createQueue(GENERATE_ASSET_METADATA_JOB_NAME);
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
	citation: "Lovelace, A. (2026). Refund policy. Journal of Policy, 4(2), 1-9.",
	description: "How and when refunds are paid.",
	language: "en",
};

beforeEach(() => {
	requests.length = 0;
	jsonAnswer.value = documentAnswer;
});

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

/** A processed library document whose title is still the uploaded file's name. */
const seedDocument = async (
	params: {
		pool?: boolean;
		budget?: number;
		capabilities?: ("text" | "image")[];
		fileName?: string | null;
		metadata?: AssetMetadataType;
		content?: string;
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
			yield* sendPutObjectCommand({
				bucket: buckets.processed.name,
				key: buildStoredExtractionKey(seeded.assetId),
				body: Buffer.from(
					serializeStoredExtractionArtifact({
						...seeded.artifact,
						content:
							params.content ??
							"Refund policy\n\nRefunds are paid within 14 days.",
						images: [],
					}),
				),
				contentType: "application/json",
			});
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
		const seeded = await seedDocument({
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
				citation: documentAnswer.citation,
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
		const seeded = await seedDocument({
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
		const seeded = await seedDocument({
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
		const seeded = await seedDocument();
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
		const seeded = await seedDocument();
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
		const seeded = await seedDocument();
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
		const seeded = await seedDocument({
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
		const seeded = await seedDocument();

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
		const seeded = await seedDocument({
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
