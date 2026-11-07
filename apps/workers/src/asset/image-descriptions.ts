import {
	type CallOutput,
	type CallSpec,
	type DescribedImage,
	figureCall,
	imageAssetCall,
	type ResolvedModel,
	readImageAssetDescription,
	utilityModel,
} from "@orcai/ai";
import {
	type AssetId,
	buckets,
	type ModelProviderKind,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema, homeScopeOf } from "@orcai/db";
import { AssetPipelineError } from "@orcai/preparation";
import type {
	ExtractionArtifact,
	ExtractionImage,
	StoredExtractionArtifact,
	StoredExtractionImage,
} from "@orcai/process";
import { getImageAsBase64 } from "@orcai/s3/server";
import type { Locale } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	assetModelCall,
	cannotReadImages,
	readsImages,
} from "@/asset/model-call";

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
			.innerJoin(resourceScope, homeScopeOf("asset", asset.id))
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

const hintOf = (image: ExtractionImage) =>
	[
		image.description,
		image.sourcePath,
	]
		.filter(Boolean)
		.join(" ");

/** One metered vision call on a stored image, with the call `kind` builds for it. */
const describe = <OUTPUT extends CallOutput>(params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: ResolvedModel;
	image: ExtractionImage & {
		sourcePath: string;
	};
	call: (kind: ModelProviderKind, image: DescribedImage) => CallSpec<OUTPUT>;
}) =>
	Effect.gen(function* () {
		const base64 = yield* getImageAsBase64({
			bucket: params.image.sourceBucket ?? buckets.processed.name,
			name: params.image.sourcePath,
		});

		return yield* assetModelCall({
			appRequestId: `image:${params.assetId}:${params.image.imageIndex}:${params.jobId}`,
			owner: params.owner,
			model: params.model,
			call: params.call(params.model.kind, {
				data: Buffer.from(base64, "base64"),
				mediaType: imageMediaType(params.image.format),
				hint: hintOf(params.image),
				locale: params.owner.locale,
			}),
		});
	});

const withSource = (image: ExtractionImage) =>
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
	model: ResolvedModel;
	artifact: ExtractionArtifact;
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
			call: imageAssetCall,
		});

		return {
			image,
			...readImageAssetDescription(output),
		};
	});

const describeImageAsset = (params: {
	assetId: AssetId;
	jobId: string;
	owner: AssetOwner;
	model: ResolvedModel;
	artifact: ExtractionArtifact;
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
	model: ResolvedModel;
	artifact: ExtractionArtifact;
}) =>
	Effect.forEach(
		params.artifact.images,
		(extracted) => {
			const image = withSource(extracted);
			if (!image) {
				return Effect.succeed<StoredExtractionImage>({
					...extracted,
					text: null,
				});
			}

			return describe({
				...params,
				image,
				call: figureCall,
			}).pipe(
				Effect.map(({ text }) => ({
					...image,
					text: text.trim() || null,
				})),
				Effect.catchIf(
					(error): error is AssetPipelineError =>
						error instanceof AssetPipelineError && error.failure !== "quota",
					(error) =>
						Effect.logWarning(
							{
								assetId: params.assetId,
								imageIndex: image.imageIndex,
								failure: error.failure,
								error: error.cause,
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
 * Describes every image of the artifact with the asset organisation's
 * utility model, metered against the uploader. Without a model that reads
 * images, figures are skipped and an image asset fails `unsupported`. A failed figure is skipped; a failed image asset fails. A
 * quota that refuses any call fails the asset with `quota`.
 */
export const describeImages = (params: {
	assetId: AssetId;
	jobId: string;
	artifact: ExtractionArtifact;
	imageAsset: boolean;
}) =>
	Effect.gen(function* () {
		const { artifact } = params;
		if (artifact.images.length === 0) {
			return {
				...artifact,
				images: [],
			} satisfies StoredExtractionArtifact;
		}

		const owner = yield* assetOwner(params.assetId);
		const model = yield* utilityModel(owner.organizationId);

		if (!readsImages(model)) {
			if (params.imageAsset) {
				return yield* cannotReadImages();
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
					text: null,
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
