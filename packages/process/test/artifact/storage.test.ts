import { describe, expect, test } from "bun:test";
import type { ExtractionResult } from "@kreuzberg/node";
import { createExtractionArtifact } from "../../src/artifact/storage";

const createExtractionResult = (): ExtractionResult => ({
	content: "",
	mimeType: "application/pdf",
	metadata: {},
	tables: [],
	detectedLanguages: null,
	chunks: null,
	images: [
		{
			data: new Uint8Array([
				1,
				2,
				3,
			]),
			format: "png",
			imageIndex: 0,
			pageNumber: 1,
			width: null,
			height: null,
			isMask: false,
			description: null,
		},
	],
	document: null,
});

describe("createExtractionArtifact", () => {
	test("drops images when transformImage returns undefined", () => {
		const artifact = createExtractionArtifact({
			result: createExtractionResult(),
			transformImage: () => undefined,
		});

		expect(artifact.images).toEqual([]);
	});

	test("keeps images when transformImage is omitted", () => {
		const artifact = createExtractionArtifact({
			result: createExtractionResult(),
		});

		expect(artifact.images).toHaveLength(1);
		expect(artifact.images[0]).not.toHaveProperty("data");
		expect(artifact.images[0]?.imageIndex).toBe(0);
	});
});
