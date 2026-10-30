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
} from "@orcai/ai";
import { buckets } from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import { type Job, settleStage } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson } from "@orcai/s3/server";
import {
	applyMetadataSuggestion,
	type GenerateAssetMetadataPayload,
	isImageFileType,
	type MetadataSuggestion,
} from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { summarizeErrorCause } from "@/asset/error-summary";
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
	(failure: "unsupported" | "other") =>
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
			timeoutMs: METADATA_TIMEOUT_MS,
		});
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
		return {
			title,
			metadata,
		} satisfies MetadataSuggestion;
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

		const extraction = yield* getObjectAsJson<StoredExtractionArtifact>({
			bucket: buckets.processed.name,
			name: buildStoredExtractionKey(job.data.assetId),
		}).pipe(
			Effect.mapError(
				(cause) =>
					new AssetPipelineError({
						failure: "other",
						cause: summarizeErrorCause(cause),
					}),
			),
		);

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
					: error instanceof AiError
						? new AssetPipelineError({
								failure: "other",
								cause: summarizeErrorCause(error),
							})
						: error,
			),
		);

		yield* store(job.data, suggestion);
	});
