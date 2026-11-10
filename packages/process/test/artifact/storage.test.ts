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

const PAGES = [
	"Refunds rose in February because the new tar-\r\niff applied to every household\r\nin the district.",
	"The council answered with a hardship fund\r\nthat pays up to two hundred euros per family.",
	"Applications close at the end of June and are\r\nhandled by the social services office.",
];

const chunk = (content: string, chunkIndex: number, firstPage = 1) => ({
	content,
	metadata: {
		byteStart: 0,
		byteEnd: content.length,
		chunkIndex,
		totalChunks: 3,
		firstPage,
		lastPage: firstPage,
	},
});

const document = (chunks: string[]): ExtractionResult => ({
	...createExtractionResult(),
	content: chunks.join("\n\n"),
	images: [],
	chunks: chunks.map((content, index) => chunk(content, index)),
	pages: PAGES.map((content, index) => ({
		pageNumber: index + 1,
		content,
		tables: [],
		images: [],
	})),
});

const pagesOf = (artifact: ReturnType<typeof createExtractionArtifact>) =>
	artifact.chunks.map(({ metadata }) => [
		metadata.firstPage,
		metadata.lastPage,
	]);

describe("chunk pages", () => {
	test("a chunk carries the pages its text is on, despite line breaks, hyphenation and Markdown", () => {
		const artifact = createExtractionArtifact({
			result: document([
				"# Refunds\n\nRefunds rose in February because the new tariff applied to every householdin the district.",
				"The council answered with a **hardship fund** that pays up to two hundred euros per family.\n\nApplications close at the end of June",
				"Applications close at the end of June and are handled by the social services office.",
			]),
		});

		expect(pagesOf(artifact)).toEqual([
			[
				1,
				1,
			],
			[
				2,
				3,
			],
			[
				3,
				3,
			],
		]);
	});

	test("a chunk that cannot be placed with certainty has no page", () => {
		const artifact = createExtractionArtifact({
			result: document([
				"Logo of the Stadtwerke Kleinmoorbach annual report and its seal",
				"Annual report seal and logo text. The council answered with a hardship fund that pays up to two hundred euros per family.",
				"Applications close at the end of June and are handled by the social services office.",
			]),
		});

		expect(pagesOf(artifact)).toEqual([
			[
				null,
				null,
			],
			[
				null,
				null,
			],
			[
				3,
				3,
			],
		]);
	});

	test("a chunk found only in one short stretch has no page", () => {
		const sentence =
			"The council answered with a hardship fund that pays up to two hundred euros per family.";
		const artifact = createExtractionArtifact({
			result: {
				...document([
					`Notes from the planning meeting on budgets, staffing and the new depot. ${sentence} So said the minutes of the evening session on transport and parking.`,
				]),
				pages: [
					{
						pageNumber: 1,
						content: `The district has published its annual figures on housing, schools and roads for every ward. ${sentence} Most families applied in spring, and the office processed their claims within a month.`,
						tables: [],
						images: [],
					},
				],
			},
		});

		expect(pagesOf(artifact)).toEqual([
			[
				null,
				null,
			],
		]);
	});

	test("text repeated on every page does not place a chunk", () => {
		const boilerplate =
			"This report is published by the district council. It may be copied for non-commercial use with acknowledgement. Questions go to the press office, which answers within five working days. Figures are provisional until the annual accounts are approved by the full council in its autumn session.";
		const sentences = [
			"Refunds rose in February.",
			"The council answered with a hardship fund.",
			"Applications close at the end of June.",
		];
		const artifact = createExtractionArtifact({
			result: {
				...document([
					boilerplate,
					`${boilerplate} The council answered`,
				]),
				pages: sentences.map((sentence, index) => ({
					pageNumber: index + 1,
					content: `${boilerplate}\n${sentence}`,
					tables: [],
					images: [],
				})),
			},
		});

		expect(pagesOf(artifact)).toEqual([
			[
				null,
				null,
			],
			[
				null,
				null,
			],
		]);
	});

	test("the stored pages keep their number and text only", () => {
		const artifact = createExtractionArtifact({
			result: document([]),
		});

		expect(artifact.pages).toEqual(
			PAGES.map((content, index) => ({
				pageNumber: index + 1,
				content,
			})),
		);
	});

	test("a presentation's slides are read from its page boundaries", () => {
		const slides = [
			"## Kategoriensystem\n\nDeduktive Kategorien leiten sich aus der Theorie ab.",
			"## Rücklauf\n\nRücklauf der Online-Befragung pro Jahr, n gesamt = 313.",
		];
		const content = slides.join("\n\n");
		const split = Buffer.byteLength(slides[0]);
		const artifact = createExtractionArtifact({
			result: {
				...createExtractionResult(),
				content,
				images: [],
				metadata: {
					pages: {
						totalCount: 2,
						unitType: "slide",
						boundaries: [
							{
								byteStart: 0,
								byteEnd: split,
								pageNumber: 1,
							},
							{
								byteStart: split,
								byteEnd: Buffer.byteLength(content),
								pageNumber: 2,
							},
						],
					},
				} as ExtractionResult["metadata"],
				chunks: [
					chunk(content, 0),
				],
				pages: [],
			},
		});

		expect(artifact.pages?.map(({ pageNumber }) => pageNumber)).toEqual([
			1,
			2,
		]);
		expect(pagesOf(artifact)).toEqual([
			[
				1,
				2,
			],
		]);
	});
});
