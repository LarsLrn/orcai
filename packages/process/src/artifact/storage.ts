import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import type { BucketName } from "@orcai/schema";
import type { StoredExtractionArtifact, StoredExtractionImage } from "./types";

export const STORED_EXTRACTION_FILE_NAME = "extraction.json";

const stripInlineImageFields = (
	image: ExtractedImage,
): StoredExtractionImage => {
	const { data: _data, ocrResult: _ocrResult, ...rest } = image;

	return rest;
};

export const createStoredExtractionArtifact = (params: {
	result: ExtractionResult;
	transformImage?: (
		image: StoredExtractionImage,
		index: number,
	) => StoredExtractionImage | undefined;
}): StoredExtractionArtifact => {
	const images = (params.result.images ?? [])
		.map(stripInlineImageFields)
		.map((image, index) =>
			params.transformImage ? params.transformImage(image, index) : image,
		)
		.filter((image): image is StoredExtractionImage => image !== undefined);

	return {
		content: params.result.content,
		mimeType: params.result.mimeType,
		metadata: params.result.metadata,
		tables: params.result.tables,
		detectedLanguages: params.result.detectedLanguages ?? [],
		chunks: params.result.chunks ?? [],
		document: params.result.document,
		qualityScore: params.result.qualityScore,
		processingWarnings: params.result.processingWarnings ?? [],
		images,
	};
};

export const createImageOnlyStoredExtractionArtifact = (params: {
	mimeType: string;
	format: string;
	sourceBucket: BucketName;
	sourcePath: string;
}): StoredExtractionArtifact =>
	({
		content: "",
		mimeType: params.mimeType,
		metadata: {
			formatType: "image",
		},
		tables: [],
		detectedLanguages: [],
		chunks: [],
		document: null,
		qualityScore: undefined,
		processingWarnings: [],
		images: [
			{
				format: params.format,
				imageIndex: 0,
				pageNumber: 1,
				width: null,
				height: null,
				isMask: false,
				description: null,
				sourceBucket: params.sourceBucket,
				sourcePath: params.sourcePath,
			},
		],
	}) as StoredExtractionArtifact;

export const serializeStoredExtractionArtifact = (
	artifact: StoredExtractionArtifact,
) => JSON.stringify(artifact);

export const deserializeStoredExtractionArtifact = (
	content: string,
): StoredExtractionArtifact => JSON.parse(content) as StoredExtractionArtifact;

export const buildProcessedAssetPrefix = (assetId: string) => `${assetId}`;

export const buildStoredExtractionKey = (assetId: string) =>
	`${buildProcessedAssetPrefix(assetId)}/${STORED_EXTRACTION_FILE_NAME}`;

export const buildStoredExtractionImageKey = (params: {
	assetId: string;
	imageIndex: number;
	format: string;
}) =>
	`${buildProcessedAssetPrefix(params.assetId)}/images/image-${params.imageIndex}.${params.format.toLowerCase()}`;
