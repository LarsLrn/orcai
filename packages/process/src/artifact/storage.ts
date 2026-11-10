import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import { processedAssetPrefix } from "@orcai/s3";
import type { BucketName } from "@orcai/schema";
import { isSlideDeck } from "../extract/slides";
import { withoutFigureText } from "./figure-text";
import { extractionPages, placeChunks } from "./pages";
import type {
	ExtractionArtifact,
	ExtractionImage,
	StoredExtractionArtifact,
} from "./types";

const STORED_EXTRACTION_FILE_NAME = "extraction.json";

const stripInlineImageFields = (image: ExtractedImage): ExtractionImage => {
	const { data: _data, ocrResult: _ocrResult, ...rest } = image;

	return rest;
};

export const createExtractionArtifact = (params: {
	result: ExtractionResult;
	transformImage?: (
		image: ExtractionImage,
		index: number,
	) => ExtractionImage | undefined;
}): ExtractionArtifact => {
	const result = withoutFigureText(params.result);
	const images = (result.images ?? [])
		.map(stripInlineImageFields)
		.map((image, index) =>
			params.transformImage ? params.transformImage(image, index) : image,
		)
		.filter((image): image is ExtractionImage => image !== undefined);
	const pages = extractionPages(result);

	return {
		content: result.content,
		mimeType: result.mimeType,
		metadata: result.metadata,
		tables: result.tables,
		detectedLanguages: result.detectedLanguages ?? [],
		// A deck whose slides extraction read was chunked slide by slide, each chunk with its slide.
		chunks:
			isSlideDeck(result) && pages.length > 0
				? (result.chunks ?? [])
				: placeChunks(result.chunks ?? [], pages),
		pages,
		document: result.document,
		qualityScore: result.qualityScore,
		processingWarnings: result.processingWarnings ?? [],
		images,
	};
};

export const createImageOnlyExtractionArtifact = (params: {
	mimeType: string;
	format: string;
	sourceBucket: BucketName;
	sourcePath: string;
}): ExtractionArtifact =>
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
	}) as ExtractionArtifact;

export const serializeStoredExtractionArtifact = (
	artifact: StoredExtractionArtifact,
) => JSON.stringify(artifact);

export const buildStoredExtractionKey = (assetId: string) =>
	`${processedAssetPrefix(assetId)}${STORED_EXTRACTION_FILE_NAME}`;

export const buildStoredExtractionImageKey = (params: {
	assetId: string;
	imageIndex: number;
	format: string;
}) =>
	`${processedAssetPrefix(params.assetId)}images/image-${params.imageIndex}.${params.format.toLowerCase()}`;
