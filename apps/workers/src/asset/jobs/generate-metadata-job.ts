import {
	AiError,
	ASSET_METADATA_INSTRUCTIONS,
	ASSET_METADATA_MAX_OUTPUT_TOKENS,
	assetMetadataOutput,
	assetMetadataPrompt,
	generateTextWithQuota,
	QuotaDeniedError,
	readAssetMetadata,
	type UtilityModel,
	utilityModel,
} from "@orcai/ai";
import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
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
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { summarizeErrorCause } from "@/asset/error-summary";
import {
	type AssetOwner,
	assetOwner,
	readImageAsset,
} from "@/asset/image-descriptions";
import {
	AssetPipelineError,
	settleMetadataAttempt,
} from "@/asset/pipeline-failure";

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
			})
			.where(
				and(
					eq(asset.id, data.assetId),
					eq(asset.metadataGeneration, data.generation),
					inArray(asset.metadataStatus, [
						"pending",
						"active",
					]),
				),
			)
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
		const { output } = yield* generateTextWithQuota({
			operation: "asset.generateMetadata",
			appRequestId: `metadata:${params.job.data.assetId}:${params.job.data.generation}:${params.job.id}`,
			organizationId: params.owner.organizationId,
			userId: params.owner.userId,
			providerId: params.model.providerId,
			modelId: params.model.modelId,
			model: params.model.language,
			system: ASSET_METADATA_INSTRUCTIONS,
			prompt,
			reservationMessages: [
				ASSET_METADATA_INSTRUCTIONS,
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
 * keeps only what it could not apply. Either way only while the job's
 * generation is the asset's.
 */
const store = (
	data: GenerateAssetMetadataPayload,
	suggestion: MetadataSuggestion,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		const current = and(
			eq(asset.id, data.assetId),
			eq(asset.metadataGeneration, data.generation),
		);

		if (data.mode === "review") {
			yield* db
				.update(asset)
				.set({
					metadataSuggestion: suggestion,
					metadataStatus: "completed",
					metadataFailure: null,
				})
				.where(current);
			return;
		}

		yield* db.transaction(() =>
			Effect.gen(function* () {
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
			}),
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
		const { organizationId } = yield* assetOwner(job.data.assetId);
		const owner = {
			organizationId,
			userId: job.data.userId,
		};
		const model = yield* utilityModel(organizationId);
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
