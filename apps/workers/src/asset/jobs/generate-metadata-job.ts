import {
	AiError,
	ASSET_METADATA_MAX_OUTPUT_TOKENS,
	assetMetadataInstructions,
	assetMetadataOutput,
	assetMetadataPrompt,
	generateTextWithQuota,
	readAssetMetadata,
	type UtilityModel,
	utilityModel,
	utilityReasoning,
} from "@orcai/ai";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import {
	AssetPipelineError,
	admit,
	claimMetadata,
	completeMetadata,
	currentMetadata,
	settleMetadataAttempt,
} from "@orcai/preparation";
import {
	readStoredExtraction,
	type StoredExtractionArtifact,
} from "@orcai/process";
import {
	type GenerateAssetMetadataPayload,
	isImageFileType,
	type MetadataSuggestion,
	type PipelineFailure,
} from "@orcai/schema";

import * as Effect from "effect/Effect";
import { modelCallFailure, summarizeErrorCause } from "@/asset/error-summary";
import {
	type AssetOwner,
	assetOwner,
	readImageAsset,
} from "@/asset/image-descriptions";

const METADATA_TIMEOUT_MS = 120_000;

/** How long a generation waiting for its file to be prepared sleeps before it looks again. */
const PREPARATION_WAIT_SECONDS = 30;

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
			Effect.catchTag("QuotaDeniedError", (denied) =>
				Effect.fail(
					new AssetPipelineError({
						failure: "quota",
						cause: denied,
					}),
				),
			),
		);
		return readAssetMetadata(output);
	});

/**
 * What the image asset's processing suggested; a review reads the image
 * again. An extraction without a suggestion is one processing has to prepare
 * again.
 */
const imageSuggestion = (params: {
	job: Job<GenerateAssetMetadataPayload>;
	owner: AssetOwner;
	model: UtilityModel;
	extraction: StoredExtractionArtifact;
}) =>
	Effect.gen(function* () {
		const { title, ...metadata } =
			params.job.data.mode === "apply"
				? (params.extraction.metadataSuggestion ??
					(yield* failWith("missing_extraction")(
						"The stored extraction has no metadata suggestion",
					)))
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

/** The asset's stored extraction, or undefined when it is gone or unreadable. */
const readExtraction = (assetId: GenerateAssetMetadataPayload["assetId"]) =>
	readStoredExtraction(assetId).pipe(
		Effect.catchTag("StoredExtractionError", () => Effect.succeed(undefined)),
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
							processingStatus: asset.processingStatus,
							generation: asset.processingGeneration,
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
						yield* admit({
							stage: "processing",
							assets: [
								row,
							],
							from: [
								"completed",
							],
							run: data.runId
								? {
										id: data.runId,
									}
								: undefined,
						});
					}

					yield* admit({
						stage: "metadata",
						continues: {
							...data,
							...((data.preparedAgain || !preparing) && {
								preparedAgain: true,
							}),
						},
						startAfter: PREPARATION_WAIT_SECONDS,
					});
					return "waiting" as const;
				}),
			);
		}),
	);

/** A delivery replayed after its run completed, or of a replaced generation, does nothing. */
export const generateMetadata = (job: Job<GenerateAssetMetadataPayload>) =>
	Effect.gen(function* () {
		const fileType = yield* claimMetadata(job.data);
		if (!fileType) {
			return yield* Effect.logInfo(
				{
					jobId: job.id,
					assetId: job.data.assetId,
				},
				"Skipping a metadata job that is done or replaced",
			);
		}
		yield* generateClaimed(job, fileType).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
						jobId: job.id,
						assetId: job.data.assetId,
						fileType,
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

		const suggestion = yield* isImageFileType(fileType)
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
				});

		yield* completeMetadata(job.data, suggestion);
	});
