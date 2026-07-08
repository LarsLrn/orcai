import type { ExtractionConfig } from "@kreuzberg/node";
import type { ExpandedExtractionConfig } from "../kreuzberg-expanded-types";
import type { ExtractionProfile } from "./types";

const baseConfig = {
	useCache: true,
	enableQualityProcessing: true,
	outputFormat: "markdown",
	resultFormat: "unified",
} satisfies ExtractionConfig;

export const getExtractionProfileConfig = (
	profile: ExtractionProfile = "asset-heavy",
): ExpandedExtractionConfig => {
	switch (profile) {
		case "chat-light":
			return {
				...baseConfig,
			};
		case "asset-heavy":
			return {
				...baseConfig,
				ocr: {
					backend: "tesseract",
					language: process.env.KREUZBERG_OCR_LANGUAGE?.trim() || "eng",
				},
				images: {
					extractImages: true,
				},
				pdfOptions: {
					extractImages: true,
				},
				pages: {
					extractPages: true,
				},
				languageDetection: {
					enabled: true,
					detectMultiple: true,
				},
				includeDocumentStructure: true,
				chunking: {
					chunkerType: "markdown",
					maxChars: 1000,
					maxOverlap: 200,
					prependHeadingContext: false,
				},
				contentFilter: {
					includeHeaders: false,
					includeFooters: false,
					stripRepeatingText: true,
					includeWatermarks: false,
				},
			};
	}
};
