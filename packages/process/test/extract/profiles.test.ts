import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getExtractionProfileConfig } from "../../src/extract/profiles";

describe("getExtractionProfileConfig", () => {
	let originalOcrLanguage: string | undefined;

	beforeEach(() => {
		originalOcrLanguage = process.env.KREUZBERG_OCR_LANGUAGE;
		delete process.env.KREUZBERG_OCR_LANGUAGE;
	});

	afterEach(() => {
		if (originalOcrLanguage === undefined) {
			delete process.env.KREUZBERG_OCR_LANGUAGE;
		} else {
			process.env.KREUZBERG_OCR_LANGUAGE = originalOcrLanguage;
		}
	});

	test("defaults to asset-heavy profile", () => {
		const config = getExtractionProfileConfig();

		expect(config.ocr).toBeDefined();
		expect(config.images?.extractImages).toBe(true);
	});

	test("chat-light profile uses base config without asset-heavy options", () => {
		const config = getExtractionProfileConfig("chat-light");

		expect(config.outputFormat).toBe("markdown");
		expect(config.resultFormat).toBe("unified");
		expect(config.useCache).toBe(true);
		expect(config.enableQualityProcessing).toBe(true);
		expect(config.ocr).toBeUndefined();
		expect(config.images).toBeUndefined();
		expect(config.chunking).toBeUndefined();
	});

	test("asset-heavy profile enables ocr, images, pages, chunking and content filtering", () => {
		const config = getExtractionProfileConfig("asset-heavy");

		expect(config.ocr).toEqual({
			backend: "tesseract",
			language: "eng",
		});
		expect(config.images).toEqual({
			extractImages: true,
		});
		expect(config.pdfOptions).toEqual({
			extractImages: true,
		});
		expect(config.pages).toEqual({
			extractPages: true,
		});
		expect(config.languageDetection).toEqual({
			enabled: true,
			detectMultiple: true,
		});
		expect(config.includeDocumentStructure).toBe(true);
		expect(config.chunking).toEqual({
			chunkerType: "markdown",
			maxChars: 1000,
			maxOverlap: 200,
			prependHeadingContext: false,
		});
		expect(config.contentFilter).toEqual({
			includeHeaders: false,
			includeFooters: false,
			stripRepeatingText: true,
			includeWatermarks: false,
		});
	});

	test("respects the KREUZBERG_OCR_LANGUAGE environment variable", () => {
		process.env.KREUZBERG_OCR_LANGUAGE = "deu";

		const config = getExtractionProfileConfig("asset-heavy");

		expect(config.ocr).toEqual({
			backend: "tesseract",
			language: "deu",
		});
	});
});
