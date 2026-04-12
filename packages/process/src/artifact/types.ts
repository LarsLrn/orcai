import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";

export type StoredExtractionImage = Omit<
	ExtractedImage,
	"data" | "ocrResult"
> & {
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
