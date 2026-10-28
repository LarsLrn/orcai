import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import type { BucketName } from "@orcai/schema";

export type StoredExtractionImage = Omit<
	ExtractedImage,
	"data" | "ocrResult"
> & {
	sourceBucket?: BucketName;
	sourcePath?: string;
	/** What the utility model read in the image, for search; null when it was skipped, missing until described. */
	text?: string | null;
};

/** Metadata the utility model suggests for an image asset. */
export type ImageMetadataSuggestion = {
	title: string;
	description: string;
	language: string;
};

export type StoredExtractionArtifact = {
	content: ExtractionResult["content"];
	mimeType: ExtractionResult["mimeType"];
	metadata: ExtractionResult["metadata"];
	tables: ExtractionResult["tables"];
	detectedLanguages: NonNullable<ExtractionResult["detectedLanguages"]>;
	chunks: NonNullable<ExtractionResult["chunks"]>;
	document: ExtractionResult["document"];
	qualityScore: ExtractionResult["qualityScore"];
	processingWarnings: NonNullable<ExtractionResult["processingWarnings"]>;
	images: StoredExtractionImage[];
	/** Set for image assets once their image is described. */
	metadataSuggestion?: ImageMetadataSuggestion;
};
