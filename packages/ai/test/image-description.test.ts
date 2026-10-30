import { describe, expect, test } from "bun:test";
import {
	figureDescriptionInstructions,
	imageAssetDescriptionInstructions,
	readImageAssetDescription,
} from "../src/image-description";

describe("figureDescriptionInstructions", () => {
	test("asks for a transcription when the hint names a table", () => {
		expect(
			figureDescriptionInstructions({
				hint: "Table 2: refunds",
				locale: "en",
			}),
		).toContain("Transcribe");
		expect(
			figureDescriptionInstructions({
				hint: "images/image-3.png",
				locale: "en",
			}),
		).not.toContain("Transcribe");
	});

	test("writes an image without text in the uploader's language", () => {
		expect(
			figureDescriptionInstructions({
				locale: "de",
			}),
		).toContain("Write the description in German, the uploader's language");
	});
});

describe("imageAssetDescriptionInstructions", () => {
	test("lists the fields only where the kind sends no schema", () => {
		const listed = imageAssetDescriptionInstructions({
			kind: "openai-compatible",
			locale: "en",
		});
		const sent = imageAssetDescriptionInstructions({
			kind: "anthropic",
			locale: "en",
		});

		expect(listed).toContain(
			'- "title": A title for the image of at most 12 words.',
		);
		expect(sent).not.toContain('"title"');
		expect(sent).toContain("in English, the uploader's language");
	});
});

describe("readImageAssetDescription", () => {
	test("trims every field and cuts the description to 300 characters", () => {
		const read = readImageAssetDescription({
			text: " Search text ",
			title: " Title ",
			description: ` ${"a".repeat(400)} `,
			language: " de ",
		});

		expect(read).toEqual({
			text: "Search text",
			suggestion: {
				title: "Title",
				description: "a".repeat(300),
				language: "de",
			},
		});
	});
});
