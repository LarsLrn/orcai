import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import type { BucketName } from "@orcai/schema";

export type StoredExtractionImage = Omit<
	ExtractedImage,
	"data" | "ocrResult"
> & {
	sourceBucket?: BucketName;
	sourcePath?: string;
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
};
