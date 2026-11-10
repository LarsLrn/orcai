import { describe, expect, test } from "bun:test";
import type { ExtractionResult } from "@kreuzberg/node";
import { createExtractionArtifact } from "../../src/artifact/storage";

type Image = NonNullable<ExtractionResult["images"]>[number];

// Kreuzberg's OCR of a table image: English only, so the umlauts are lost.
const TABLE_OCR =
	"Gebuhrenordnung (Auszug)\n\nLeistung Erwachsene Ermabigt\nJahresausweis 25,00 € 12,50 €\nSaumnisgebuhr je Medium und Woche 1,50€ 0,75€";
const CHART_OCR =
	"| Ausleihen 41.200 |  |  |\n| --- | --- | --- |\n| 2023 | 2024 | 2025 |";

const image = (imageIndex: number, ocr: string, pageNumber = 1): Image => ({
	data: new Uint8Array(),
	format: "png",
	imageIndex,
	pageNumber,
	width: 900,
	height: 380,
	isMask: false,
	description: null,
	ocrResult: {
		content: ocr,
		mimeType: "text/plain",
		metadata: {},
		tables: [],
		detectedLanguages: null,
		chunks: null,
		images: null,
		document: null,
	},
});

const chunk = (content: string, chunkIndex: number, totalChunks: number) => ({
	content,
	metadata: {
		byteStart: 0,
		byteEnd: 0,
		chunkIndex,
		totalChunks,
	},
});

const result = (params: {
	content: string;
	chunks: string[];
	images: Image[];
	pages?: string[];
}): ExtractionResult => ({
	content: params.content,
	mimeType: "application/pdf",
	metadata: {},
	tables: [],
	detectedLanguages: null,
	chunks: params.chunks.map((content, index) =>
		chunk(content, index, params.chunks.length),
	),
	images: params.images,
	pages: params.pages?.map((content, index) => ({
		pageNumber: index + 1,
		content,
		tables: [],
		images: [],
	})),
	document: null,
});

const BODY =
	"Die Hauptstelle verzeichnet einen leichten Rückgang bei gedruckten Medien.";
const CAPTION = "Abbildung 1: Auszug aus der Gebührensatzung.";
// Kreuzberg joins the OCR lines into one paragraph after the placeholder.
const INLINED_TABLE =
	"Gebuhrenordnung (Auszug) Leistung Erwachsene Ermabigt Jahresausweis 25,00 € 12,50 € Saumnisgebuhr je Medium und Woche 1,50€ 0,75€";

describe("figure text", () => {
	test("leaves the text read in a figure out of the content and the chunks, and keeps the figure's place and caption", () => {
		const content = `${BODY}\n\n![](image_0.png)\n\n${INLINED_TABLE}\n\n${CAPTION}\n`;
		const artifact = createExtractionArtifact({
			result: result({
				content,
				chunks: [
					`${BODY}\n\n![](image_0.png)\n\n${INLINED_TABLE}\n\n${CAPTION}`,
				],
				images: [
					image(0, TABLE_OCR),
				],
				pages: [
					`${BODY}\r\n${CAPTION}`,
				],
			}),
		});

		expect(artifact.content).toBe(
			`${BODY}\n\n![](image_0.png)\n\n${CAPTION}\n`,
		);
		expect(artifact.chunks.map(({ content }) => content)).toEqual([
			`${BODY}\n\n![](image_0.png)\n\n${CAPTION}`,
		]);
		expect(artifact.chunks[0]?.metadata).toMatchObject({
			firstPage: 1,
			lastPage: 1,
		});
		expect(artifact.images[0]).not.toHaveProperty("ocrResult");
	});

	test("takes figure text out of chunks that end or start inside it, and drops a chunk that is only figure text", () => {
		const chart =
			"| Ausleihen 41.200 | | | | --- | --- | --- | | 2023 | 2024 | 2025 |";
		const content = `${BODY}\n\n![](image_1.png)\n\n${chart}\n\n![](image_0.png)\n\n${INLINED_TABLE}\n\n${CAPTION}`;
		const artifact = createExtractionArtifact({
			result: result({
				content,
				chunks: [
					`${BODY}\n\n![](image_1.png)\n\n| Ausleihen 41.200 | | |`,
					"| --- | --- | --- | | 2023 | 2024 | 2025 |\n\n![](image_0.png)\n\nGebuhrenordnung (Auszug) Leistung",
					"Leistung Erwachsene Ermabigt Jahresausweis 25,00 € 12,50 € Saumnisgebuhr je Medium und",
					`Medium und Woche 1,50€ 0,75€\n\n${CAPTION}`,
				],
				images: [
					image(0, TABLE_OCR),
					image(1, CHART_OCR),
				],
			}),
		});

		expect(artifact.content).toBe(
			`${BODY}\n\n![](image_1.png)\n\n![](image_0.png)\n\n${CAPTION}`,
		);
		expect(
			artifact.chunks.map(({ content, metadata }) => [
				content,
				metadata.chunkIndex,
				metadata.totalChunks,
			]),
		).toEqual([
			[
				`${BODY}\n\n![](image_1.png)`,
				0,
				3,
			],
			[
				"![](image_0.png)",
				1,
				3,
			],
			[
				CAPTION,
				2,
				3,
			],
		]);
	});

	test("finds figure text in a chunk the chunker wrote without the figure's placeholder", () => {
		const artifact = createExtractionArtifact({
			result: result({
				content: `${CAPTION}\n\n![](image_0.png)\n\nQuokka Ledger\n`,
				chunks: [
					`${CAPTION}\n\nQuokka Ledger`,
				],
				images: [
					image(0, "Quokka Ledger"),
				],
			}),
		});

		expect(artifact.content).toBe(`${CAPTION}\n\n![](image_0.png)\n`);
		expect(artifact.chunks.map(({ content }) => content)).toEqual([
			CAPTION,
		]);
	});

	test("keeps the text read on a scanned page, which has no figure placeholder", () => {
		const pageText =
			"Die Stadtbibliothek Musterstadt steht allen Bürgerinnen und Bürgern offen.";
		const artifact = createExtractionArtifact({
			result: result({
				content: `${pageText}\n`,
				chunks: [
					pageText,
				],
				images: [
					image(
						0,
						"Die Stadtbibliothek Musterstadt steht allen Burgerinnen und Burgern offen.",
					),
				],
				pages: [
					"",
				],
			}),
		});

		expect(artifact.content).toBe(`${pageText}\n`);
		expect(artifact.chunks.map(({ content }) => content)).toEqual([
			pageText,
		]);
	});

	test("keeps text after a placeholder that is not the figure's", () => {
		const content = `![](image_0.png)\n\n${CAPTION}\n\n${INLINED_TABLE}`;
		const artifact = createExtractionArtifact({
			result: result({
				content,
				chunks: [
					content,
				],
				images: [
					image(0, TABLE_OCR),
				],
			}),
		});

		expect(artifact.content).toBe(content);
		expect(artifact.chunks[0]?.content).toBe(content);
	});

	test("keeps a paragraph that repeats the figure text when its chunk could be either", () => {
		const repeated = "Loans rose by a third in 2024.";
		const content = `Intro.\n\n![](image_0.png)\n\n${repeated}\n\n${repeated}\n\nOutro.`;
		const artifact = createExtractionArtifact({
			result: result({
				content,
				chunks: [
					`Intro.\n\n![](image_0.png)\n\n${repeated}`,
					repeated,
					"Outro.",
				],
				images: [
					image(0, repeated),
				],
			}),
		});

		expect(artifact.content).toBe(
			`Intro.\n\n![](image_0.png)\n\n${repeated}\n\nOutro.`,
		);
		expect(artifact.chunks.map(({ content }) => content)).toEqual([
			"Intro.\n\n![](image_0.png)",
			repeated,
			"Outro.",
		]);
	});

	test("keeps text that only resembles the figure's text", () => {
		const cases = [
			[
				"Revenue 1.23",
				"![](image_0.png)\n\nRevenue 123\n\nThe rest.",
			],
			[
				"Annual report",
				"Body.\n\n![](image_0.png)\n\nAnnual",
			],
		];
		for (const [ocr, content] of cases) {
			const artifact = createExtractionArtifact({
				result: result({
					content,
					chunks: [
						content,
					],
					images: [
						image(0, ocr),
					],
					pages: [
						content,
					],
				}),
			});

			expect(artifact.content).toBe(content);
			expect(artifact.chunks[0]?.content).toBe(content);
			expect(artifact.pages?.[0]?.content).toBe(content);
		}
	});

	test("finds figure text after characters outside the Basic Multilingual Plane", () => {
		const intro = "Das Zeichen \u{10400} steht im Deseret-Alphabet.";
		const artifact = createExtractionArtifact({
			result: result({
				content: `${intro}\n\n![](image_0.png)\n\nQuokka Ledger\n`,
				chunks: [
					`${intro}\n\n![](image_0.png)\n\nQuokka Ledger`,
				],
				images: [
					image(0, "Quokka Ledger"),
				],
			}),
		});

		expect(artifact.content).toBe(`${intro}\n\n![](image_0.png)\n`);
		expect(artifact.chunks[0]?.content).toBe(`${intro}\n\n![](image_0.png)`);
	});
});
