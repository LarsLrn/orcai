import {
	AiError,
	ASSET_METADATA_MAX_OUTPUT_TOKENS,
	assetMetadataInstructions,
	assetMetadataOutput,
	assetMetadataPrompt,
	generateTextWithQuota,
	QuotaDeniedError,
	readAssetMetadata,
	type UtilityModel,
	utilityModel,
	utilityReasoning,
} from "@orcai/ai";
import { buckets } from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	type Job,
	queueProcessing,
	sendJobBatchInTransaction,
	settleStage,
} from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson, isS3NoSuchKey } from "@orcai/s3/server";
import {
	applyMetadataSuggestion,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	isImageFileType,
	type MetadataSuggestion,
	type PipelineFailure,
} from "@orcai/schema";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { modelCallFailure, summarizeErrorCause } from "@/asset/error-summary";
import {
	type AssetOwner,
	assetOwner,
	readImageAsset,
} from "@/asset/image-descriptions";
import {
	AssetPipelineError,
	currentMetadata,
	settleMetadataAttempt,
} from "@/asset/pipeline-attempt";

const METADATA_TIMEOUT_MS = 120_000;

/** How long a generation waiting for its file to be prepared sleeps before it looks again. */
const PREPARATION_WAIT_SECONDS = 30;

export const generateMetadataBatch = (
	jobs: Job<GenerateAssetMetadataPayload>[],
) =>
	Effect.forEach(jobs, generateMetadata, {
		discard: true,
	});

/** Whether the job's generation is still the asset's and not done. */
const claim = (data: GenerateAssetMetadataPayload) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		const [claimed] = yield* db
			.update(asset)
			.set({
				metadataStatus: "active",
				metadataFailure: null,
			})
			.where(currentMetadata(data))
			.returning({
				fileType: asset.fileType,
			});
		return claimed;
	});

const failWith =
	(failure: PipelineFailure) =>
	(message: string): Effect.Effect<never, AssetPipelineError> =>
		Effect.fail(
			new AssetPipelineError({
				failure,
				cause: new Error(message),
			}),
		);

const documentSuggestion = (params: {
	job: Job<GenerateAssetMetadataPayload>;
	owner: AssetOwner;
	model: UtilityModel;
	extraction: StoredExtractionArtifact;
}) =>
	Effect.gen(function* () {
		const { metadata } = params.extraction;
		const prompt = assetMetadataPrompt({
			content: params.extraction.content,
			hints: {
				title: metadata.title,
				authors: metadata.authors,
				keywords: metadata.keywords,
				subject: metadata.subject,
				pageCount: metadata.pageCount,
				languages: params.extraction.detectedLanguages,
			},
		});
		const instructions = assetMetadataInstructions(params.model.kind);
		const { output } = yield* generateTextWithQuota({
			operation: "asset.generateMetadata",
			appRequestId: `metadata:${params.job.data.assetId}:${params.job.data.generation}:${params.job.id}`,
			organizationId: params.owner.organizationId,
			userId: params.owner.userId,
			providerId: params.model.providerId,
			modelId: params.model.modelId,
			model: params.model.language,
			system: instructions,
			prompt,
			reservationMessages: [
				instructions,
				prompt,
			],
			output: assetMetadataOutput,
			maxOutputTokens: ASSET_METADATA_MAX_OUTPUT_TOKENS,
			reasoning: utilityReasoning(params.model.kind),
			timeoutMs: METADATA_TIMEOUT_MS,
		}).pipe(
			Effect.mapError((error) =>
				error instanceof AiError
					? modelCallFailure(error, ASSET_METADATA_MAX_OUTPUT_TOKENS)
					: error,
			),
		);
		return readAssetMetadata(output);
	});

/**
 * What the image asset's processing suggested; a review, or an extraction
 * without one, reads the image again.
 */
const imageSuggestion = (params: {
	job: Job<GenerateAssetMetadataPayload>;
	owner: AssetOwner;
	model: UtilityModel;
	extraction: StoredExtractionArtifact;
}) =>
	Effect.gen(function* () {
		const stored = params.extraction.metadataSuggestion;
		const { title, ...metadata } =
			stored && params.job.data.mode === "apply"
				? stored
				: params.model.capabilities.includes("image")
					? (yield* readImageAsset({
							assetId: params.job.data.assetId,
							jobId: params.job.id,
							owner: params.owner,
							model: params.model,
							artifact: params.extraction,
						})).suggestion
					: yield* failWith("unsupported")(
							"The utility model cannot read images",
						);
		const suggestion: MetadataSuggestion = {
			title,
			metadata,
		};
		return suggestion;
	});

/**
 * In `review` mode the suggestion is kept whole. In `apply` mode it fills
 * empty fields on the row as it is now, so an edit saved meanwhile wins, and
 * keeps only what it could not apply; the run's member records the fields it
 * filled. Either way only while the job's generation is the asset's and
 * unfinished, so a duplicate delivery stores nothing, and a deadlocked store
 * runs again without asking the model again.
 */
const store = (
	data: GenerateAssetMetadataPayload,
	suggestion: MetadataSuggestion,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, asset } = dbSchema;
		const current = currentMetadata(data);
		const target = {
			stage: "metadata",
			assetId: data.assetId,
		} as const;

		yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					if (data.mode === "review") {
						const stored = yield* db
							.update(asset)
							.set({
								metadataSuggestion: suggestion,
								metadataStatus: "completed",
								metadataFailure: null,
							})
							.where(current)
							.returning({
								id: asset.id,
							});
						if (stored.length > 0) {
							yield* settleStage(data.runId, target, {
								state: "completed",
							});
						}
						return;
					}

					const [row] = yield* db
						.select({
							title: asset.title,
							fileName: asset.fileName,
							metadata: asset.metadata,
						})
						.from(asset)
						.where(current)
						.for("update");
					if (!row) {
						return;
					}
					const applied = applyMetadataSuggestion(row, suggestion);
					yield* db
						.update(asset)
						.set({
							title: applied.title,
							metadata: applied.metadata,
							metadataSuggestion: applied.review,
							metadataStatus: "completed",
							metadataFailure: null,
							updatedAt: new Date(),
						})
						.where(current);
					yield* settleStage(data.runId, target, {
						state: "completed",
					});
					if (data.runId) {
						yield* db
							.update(activityMember)
							.set({
								appliedFields: applied.filled,
							})
							.where(
								and(
									eq(activityMember.runId, data.runId),
									eq(activityMember.assetId, data.assetId),
								),
							);
					}
				}),
			),
		);
	});

/** The asset's stored extraction, or undefined when there is none. */
const readExtraction = (assetId: GenerateAssetMetadataPayload["assetId"]) =>
	getObjectAsJson<StoredExtractionArtifact>({
		bucket: buckets.processed.name,
		name: buildStoredExtractionKey(assetId),
	}).pipe(
		Effect.catchIf(isS3NoSuchKey, () => Effect.succeed(undefined)),
		Effect.mapError(
			(cause) =>
				new AssetPipelineError({
					failure: "other",
					cause: summarizeErrorCause(cause),
				}),
		),
	);

/**
 * The generation's file is being prepared, or was prepared and its extraction
 * is gone: a completed file is prepared again, once per generation, as the
 * run's work. Hands the generation on to a new one that looks again once
 * preparation had time, so the delivery's own retries and duplicates find it
 * replaced. `missing` when there is nothing to wait for: preparation failed,
 * or already ran for this generation. Processing stores the extraction before
 * it completes the asset, so with the completed asset locked the extraction
 * read again is current, and one stored meanwhile is returned.
 */
const awaitPreparation = (data: GenerateAssetMetadataPayload) =>
	retryDeadlocks(
		Effect.gen(function* () {
			const db = yield* DB;
			const { asset } = dbSchema;
			return yield* db.transaction(() =>
				Effect.gen(function* () {
					const [row] = yield* db
						.select({
							id: asset.id,
							bucket: asset.bucket,
							prefix: asset.prefix,
							fileType: asset.fileType,
							processingStatus: asset.processingStatus,
							processingGeneration: asset.processingGeneration,
						})
						.from(asset)
						.where(currentMetadata(data))
						.for("update");
					if (!row) return "replaced" as const;

					const preparing =
						row.processingStatus === "pending" ||
						row.processingStatus === "active";
					if (!preparing) {
						if (row.processingStatus !== "completed") {
							return "missing" as const;
						}
						const stored = yield* readExtraction(row.id);
						if (stored) return stored;
						if (data.preparedAgain) return "missing" as const;
						yield* queueProcessing(
							row,
							[
								"completed",
							],
							data.runId
								? {
										id: data.runId,
									}
								: undefined,
						);
					}

					const [next] = yield* db
						.update(asset)
						.set({
							metadataStatus: "pending",
							metadataGeneration: sql`${asset.metadataGeneration} + 1`,
						})
						.where(eq(asset.id, row.id))
						.returning({
							generation: asset.metadataGeneration,
						});
					yield* sendJobBatchInTransaction<GenerateAssetMetadataPayload>({
						jobName: GENERATE_ASSET_METADATA_JOB_NAME,
						jobs: [
							{
								data: {
									...data,
									generation: next.generation,
									...((data.preparedAgain || !preparing) && {
										preparedAgain: true,
									}),
								},
								options: {
									startAfter: PREPARATION_WAIT_SECONDS,
								},
							},
						],
					});
					return "waiting" as const;
				}),
			);
		}),
	);

/** A delivery replayed after its run completed, or of a replaced generation, does nothing. */
const generateMetadata = (job: Job<GenerateAssetMetadataPayload>) =>
	Effect.gen(function* () {
		const claimed = yield* claim(job.data);
		if (!claimed) {
			return yield* Effect.logInfo(
				{
					jobId: job.id,
					assetId: job.data.assetId,
				},
				"Skipping a metadata job that is done or replaced",
			);
		}
		yield* generateClaimed(job, claimed.fileType).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
						jobId: job.id,
						assetId: job.data.assetId,
						fileType: claimed.fileType,
						stage: "metadata",
					},
					"Generate asset metadata job failed",
				),
			),
			(attempt) => settleMetadataAttempt(job.data, attempt),
		);
	});

const generateClaimed = (
	job: Job<GenerateAssetMetadataPayload>,
	fileType: string,
) =>
	Effect.gen(function* () {
		const owner = {
			...(yield* assetOwner(job.data.assetId)),
			userId: job.data.userId,
		};
		const model = yield* utilityModel(owner.organizationId);
		if (!model) {
			return yield* failWith("unsupported")(
				"The organisation has no usable utility model",
			);
		}

		const read = yield* readExtraction(job.data.assetId);
		const extraction = read ?? (yield* awaitPreparation(job.data));
		if (extraction === "missing") {
			return yield* failWith("missing_extraction")(
				"The stored extraction is missing",
			);
		}
		if (typeof extraction === "string") {
			return yield* Effect.logInfo(
				{
					jobId: job.id,
					assetId: job.data.assetId,
					fileType,
					preparation: extraction,
				},
				"Metadata waits for the file to be prepared",
			);
		}

		const suggestion = yield* (
			isImageFileType(fileType)
				? imageSuggestion({
						job,
						owner,
						model,
						extraction,
					})
				: documentSuggestion({
						job,
						owner,
						model,
						extraction,
					})
		).pipe(
			Effect.mapError((error) =>
				error instanceof QuotaDeniedError
					? new AssetPipelineError({
							failure: "quota",
							cause: error,
						})
					: error,
			),
		);

		yield* store(job.data, suggestion);
	});
