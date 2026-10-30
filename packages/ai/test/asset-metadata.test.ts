import { describe, expect, test } from "bun:test";
import {
	assetMetadataInstructions,
	assetMetadataPrompt,
	readAssetMetadata,
} from "../src/asset-metadata";

describe("assetMetadataInstructions", () => {
	test("lists every field from the schema where the kind sends no schema", () => {
		const listed = assetMetadataInstructions("openai-compatible");

		expect(listed.match(/^- "\w+": \S/gm)).toHaveLength(17);
		expect(listed).toContain(
			'- "sourceType": The kind of source, one of "book", "journal-article", "web-source", "legal-text".',
		);
		expect(assetMetadataInstructions("openai")).not.toContain('"sourceType"');
	});
});

describe("assetMetadataPrompt", () => {
	test("leads with the extraction's details and keeps the start of a long text", () => {
		const prompt = assetMetadataPrompt({
			content: `Refunds\n\n${"a".repeat(40_000)}TAIL`,
			hints: {
				title: "Refund policy",
				authors: [
					"Ada Lovelace",
					"Grace Hopper",
				],
				pageCount: 12,
				languages: [
					"de",
				],
			},
		});

		expect(
			prompt.startsWith(
				"<document_details>\nTitle in the file: Refund policy\nAuthors in the file: Ada Lovelace; Grace Hopper\nPages: 12\nDetected language: de\n</document_details>\n<document_text>\nRefunds",
			),
		).toBe(true);
		expect(prompt).not.toContain("TAIL");
		expect(prompt.endsWith("[…]\n</document_text>")).toBe(true);
	});

	test("has only the text when the extraction knows nothing else", () => {
		expect(
			assetMetadataPrompt({
				content: " Short text ",
				hints: {},
			}),
		).toBe("<document_text>\nShort text\n</document_text>");
	});
});

describe("readAssetMetadata", () => {
	test("drops empty fields and cuts the description to 300 characters", () => {
		expect(
			readAssetMetadata({
				title: " Refund policy ",
				sourceType: null,
				author: " ",
				chapterTitle: null,
				journalName: null,
				volume: null,
				issueNumber: null,
				pageRange: null,
				doi: null,
				websiteName: "Example",
				externalUrl: null,
				accessDate: null,
				legalReference: null,
				jurisdiction: null,
				citation: null,
				description: "d".repeat(400),
				language: "en",
			}),
		).toEqual({
			title: "Refund policy",
			metadata: {
				websiteName: "Example",
				language: "en",
				description: "d".repeat(300),
			},
		});
	});

	test("takes null for what the document does not state, and only a valid language tag", () => {
		expect(
			readAssetMetadata({
				title: null,
				sourceType: null,
				author: null,
				chapterTitle: null,
				journalName: null,
				volume: null,
				issueNumber: null,
				pageRange: null,
				doi: null,
				websiteName: null,
				externalUrl: null,
				accessDate: null,
				legalReference: null,
				jurisdiction: null,
				citation: null,
				description: null,
				language: "en-",
			}),
		).toEqual({
			title: undefined,
			metadata: {},
		});
	});
});
