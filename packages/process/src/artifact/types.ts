import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import type { BucketName } from "@orcai/schema";
import type { ExpandedMetadata } from "../kreuzberg-expanded-types";
import type { ExtractionPage } from "./pages";

/** An image as extraction found it, before the utility model describes it. */
export type ExtractionImage = Omit<ExtractedImage, "data" | "ocrResult"> & {
	sourceBucket?: BucketName;
	sourcePath?: string;
};

export type StoredExtractionImage = ExtractionImage & {
	/** What the utility model read in the image, for search; null when it was skipped. */
	text: string | null;
};

/** Metadata the utility model suggests for an image asset. */
type ImageMetadataSuggestion = {
	title: string;
	description: string;
	/** Left out when the model's answer is no BCP 47 tag. */
	language?: string;
};

export type StoredExtractionArtifact = {
	content: ExtractionResult["content"];
	mimeType: ExtractionResult["mimeType"];
	metadata: ExpandedMetadata;
	tables: ExtractionResult["tables"];
	detectedLanguages: NonNullable<ExtractionResult["detectedLanguages"]>;
	/** Each with the pages its text was found on, none where that is uncertain. */
	chunks: NonNullable<ExtractionResult["chunks"]>;
	/** Absent from extractions stored without their pages. */
	pages?: ExtractionPage[];
	document: ExtractionResult["document"];
	qualityScore: ExtractionResult["qualityScore"];
	processingWarnings: NonNullable<ExtractionResult["processingWarnings"]>;
	images: StoredExtractionImage[];
	/** Set for image assets. */
	metadataSuggestion?: ImageMetadataSuggestion;
};

/** An extraction before its images are described, which processing does before it stores it. */
export type ExtractionArtifact = Omit<
	StoredExtractionArtifact,
	"images" | "metadataSuggestion"
> & {
	images: ExtractionImage[];
};
