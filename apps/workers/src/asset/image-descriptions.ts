import {
	AiError,
	figureDescriptionInstructions,
	generateTextWithQuota,
	IMAGE_DESCRIPTION_MAX_OUTPUT_TOKENS,
	imageAssetDescriptionInstructions,
	imageAssetDescriptionOutput,
	QuotaDeniedError,
	readImageAssetDescription,
	type UtilityModel,
	utilityModel,
} from "@orcai/ai";
import {
	type AssetId,
	buckets,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	StoredExtractionArtifact,
	StoredExtractionImage,
} from "@orcai/process";
import { getImageAsBase64 } from "@orcai/s3/server";
import type { Locale } from "@orcai/schema";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { summarizeErrorCause } from "@/asset/error-summary";
import { AssetPipelineError } from "@/asset/pipeline-attempt";

/** A description that takes longer counts as failed. */
const IMAGE_DESCRIPTION_TIMEOUT_MS = 120_000;

/** Who the model calls for an asset are metered against, and the uploader's locale for images without text. */
export interface AssetOwner {
	organizationId: OrganizationId;
	userId: UserId;
	locale: Locale;
}

/** The organisation the asset belongs to, its uploader and the uploader's locale. */
export const assetOwner = (assetId: AssetId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset, resourceScope, user } = dbSchema;
		const [owner] = yield* db
			.select({
				organizationId: resourceScope.organizationId,
				userId: asset.userId,
				locale: user.locale,
			})
			.from(asset)
			.innerJoin(user, eq(user.id, asset.userId))
			.innerJoin(
				resourceScope,
				and(
					eq(resourceScope.resourceType, "asset"),
					eq(resourceScope.resourceId, asset.id),
					eq(resourceScope.isPrimary, true),
					isNull(resourceScope.endedAt),
				),
			)
			.where(eq(asset.id, assetId))
			.limit(1);

		if (!owner) {
			return yield* new AssetPipelineError({
				failure: "other",
				cause: new Error(`Asset ${assetId} belongs to no organisation`),
			});
		}
		return {
			...owner,
			locale: owner.locale ?? "en",
		} satisfies AssetOwner;
	});

export const imageMediaType = (format: string) => {
	const normalized = format.toLowerCase();
	return normalized === "jpg" ? "image/jpeg" : `image/${normalized}`;
};

const hintOf = (image: StoredExtractionImage) =>
	[
		image.description,
		image.sourcePath,
	]
		.filter(Boolean)
		.join(" ");

/** One metered vision call on a stored image. */
const describe = (params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: UtilityModel;
	image: StoredExtractionImage & {
		sourcePath: string;
	};
	instructions: string;
	output?: typeof imageAssetDescriptionOutput;
}) =>
	Effect.gen(function* () {
		const base64 = yield* getImageAsBase64({
			bucket: params.image.sourceBucket ?? buckets.processed.name,
			name: params.image.sourcePath,
		});

		return yield* generateTextWithQuota({
			operation: "asset.describeImage",
			appRequestId: `image:${params.assetId}:${params.image.imageIndex}:${params.jobId}`,
			organizationId: params.owner.organizationId,
			userId: params.owner.userId,
			providerId: params.model.providerId,
			modelId: params.model.modelId,
			model: params.model.language,
			system: params.instructions,
			output: params.output,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "file",
							data: Buffer.from(base64, "base64"),
							mediaType: imageMediaType(params.image.format),
						},
					],
				},
			],
			reservationMessages: [
				params.instructions,
			],
			maxOutputTokens: IMAGE_DESCRIPTION_MAX_OUTPUT_TOKENS,
			timeoutMs: IMAGE_DESCRIPTION_TIMEOUT_MS,
		}).pipe(
			Effect.mapError((error) =>
				error instanceof QuotaDeniedError
					? new AssetPipelineError({
							failure: "quota",
							cause: error,
						})
					: error,
			),
		);
	});

const withSource = (image: StoredExtractionImage) =>
	image.sourcePath
		? {
				...image,
				sourcePath: image.sourcePath,
			}
		: undefined;

/** One structured vision call on an image asset: its search text and a metadata suggestion. */
export const readImageAsset = (params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: UtilityModel;
	artifact: StoredExtractionArtifact;
}) =>
	Effect.gen(function* () {
		const [stored] = params.artifact.images;
		const image = stored && withSource(stored);
		if (!image) {
			return yield* new AssetPipelineError({
				failure: "other",
				cause: new Error(`Image asset ${params.assetId} has no stored image`),
			});
		}

		const { output } = yield* describe({
			...params,
			image,
			instructions: imageAssetDescriptionInstructions({
				kind: params.model.kind,
				hint: hintOf(image),
				locale: params.owner.locale,
			}),
			output: imageAssetDescriptionOutput,
		}).pipe(
			Effect.mapError((error) =>
				error instanceof AiError
					? new AssetPipelineError({
							failure: "other",
							cause: summarizeErrorCause(error),
						})
					: error,
			),
		);

		return {
			image,
			...readImageAssetDescription(output),
		};
	});

const describeImageAsset = (params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: UtilityModel;
	artifact: StoredExtractionArtifact;
}) =>
	readImageAsset(params).pipe(
		Effect.map(
			({ image, text, suggestion }): StoredExtractionArtifact => ({
				...params.artifact,
				images: [
					{
						...image,
						text,
					},
				],
				metadataSuggestion: suggestion,
			}),
		),
	);

const describeFigures = (params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: UtilityModel;
	artifact: StoredExtractionArtifact;
}) =>
	Effect.forEach(
		params.artifact.images,
		(stored) => {
			const image = withSource(stored);
			if (stored.text !== undefined || !image) {
				return Effect.succeed({
					...stored,
					text: stored.text ?? null,
				});
			}

			return describe({
				...params,
				image,
				instructions: figureDescriptionInstructions({
					hint: hintOf(image),
					locale: params.owner.locale,
				}),
			}).pipe(
				Effect.map(({ text }) => ({
					...image,
					text: text.trim() || null,
				})),
				Effect.catchIf(
					(error) => error instanceof AiError,
					(error) =>
						Effect.logWarning(
							{
								assetId: params.assetId,
								imageIndex: image.imageIndex,
								error: summarizeErrorCause(error),
							},
							"Skipping a figure whose description failed",
						).pipe(
							Effect.as({
								...image,
								text: null,
							}),
						),
				),
			);
		},
		{
			concurrency: 2,
		},
	).pipe(
		Effect.map(
			(images): StoredExtractionArtifact => ({
				...params.artifact,
				images,
			}),
		),
	);

/**
 * Describes every image of the artifact not described yet with the asset
 * organisation's utility model, metered against the uploader. Without a model
 * that reads images, figures are skipped and an image asset fails
 * `unsupported`. A failed figure is skipped; a failed image asset fails. A
 * quota that refuses any call fails the asset with `quota`.
 */
export const describeImages = (params: {
	assetId: AssetId;
	jobId: string;
	artifact: StoredExtractionArtifact;
	imageAsset: boolean;
}) =>
	Effect.gen(function* () {
		const { artifact } = params;
		if (artifact.images.every((image) => image.text !== undefined)) {
			return artifact;
		}

		const owner = yield* assetOwner(params.assetId);
		const model = yield* utilityModel(owner.organizationId);

		if (!model?.capabilities?.includes("image")) {
			if (params.imageAsset) {
				return yield* new AssetPipelineError({
					failure: "unsupported",
					cause: new Error("The utility model cannot read images"),
				});
			}
			yield* Effect.logWarning(
				{
					assetId: params.assetId,
					imageCount: artifact.images.length,
				},
				"Skipping figures: the utility model cannot read images",
			);
			return {
				...artifact,
				images: artifact.images.map((image) => ({
					...image,
					text: image.text ?? null,
				})),
			} satisfies StoredExtractionArtifact;
		}

		const described = {
			...params,
			owner,
			model,
		};
		return yield* params.imageAsset
			? describeImageAsset(described)
			: describeFigures(described);
	});
