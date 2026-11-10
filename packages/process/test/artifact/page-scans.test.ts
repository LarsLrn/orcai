import { describe, expect, test } from "bun:test";
import type { ExtractionResult } from "@kreuzberg/node";
import { isPageScan } from "../../src/artifact/page-scans";
import { createExtractionArtifact } from "../../src/artifact/storage";

type Image = NonNullable<ExtractionResult["images"]>[number];

const A4: [
	number,
	number,
] = [
	595,
	842,
];

const ocrResult = (content: string): Image["ocrResult"] => ({
	content,
	mimeType: "text/plain",
	metadata: {},
	tables: [],
	detectedLanguages: null,
	chunks: null,
	images: null,
	document: null,
});

// A page scanned at 200 dpi, as Kreuzberg returns it: the page has no text of its own.
const scan = (overrides: Partial<Image> = {}): Image => ({
	data: new Uint8Array(),
	format: "png",
	imageIndex: 0,
	pageNumber: 1,
	width: 1651,
	height: 2337,
	isMask: false,
	description: null,
	ocrResult: ocrResult("Die Stadtbibliothek Musterstadt steht allen offen."),
	...overrides,
});

const document = (params: {
	pageText?: string;
	dimensions?: [
		number,
		number,
	];
	images: Image[];
}): ExtractionResult => ({
	content: "Die Stadtbibliothek Musterstadt steht allen offen.\n",
	mimeType: "application/pdf",
	metadata: {
		pages: {
			totalCount: 1,
			unitType: "page",
			pages: [
				{
					number: 1,
					dimensions: params.dimensions,
				},
			],
		},
	} as ExtractionResult["metadata"],
	tables: [],
	detectedLanguages: null,
	chunks: null,
	images: params.images,
	pages: [
		{
			pageNumber: 1,
			content: params.pageText ?? "",
			tables: [],
			images: [],
		},
	],
	document: null,
});

const pageScan = (params: Parameters<typeof document>[0]) => {
	const result = document(params);
	return isPageScan(result, params.images[0] as Image);
};

describe("isPageScan", () => {
	test("is true for an image the size of its page when the page's text came from OCR", () => {
		expect(
			pageScan({
				dimensions: A4,
				images: [
					scan(),
				],
			}),
		).toBe(true);
	});

	test("is false on a page with text of its own", () => {
		expect(
			pageScan({
				pageText: "Jahresbericht 2025",
				dimensions: A4,
				images: [
					scan(),
				],
			}),
		).toBe(false);
	});

	test("is false for an image of another shape than its page", () => {
		expect(
			pageScan({
				dimensions: [
					612,
					792,
				],
				images: [
					scan({
						width: 2550,
						height: 2100,
					}),
				],
			}),
		).toBe(false);
	});

	test("is false when OCR read nothing in the image, which is then the page's only content", () => {
		expect(
			pageScan({
				dimensions: A4,
				images: [
					scan({
						ocrResult: ocrResult(""),
					}),
				],
			}),
		).toBe(false);
	});

	test("is false when the page's size or the image's is unknown", () => {
		expect(
			pageScan({
				images: [
					scan(),
				],
			}),
		).toBe(false);
		expect(
			pageScan({
				dimensions: A4,
				images: [
					scan({
						width: null,
						height: null,
					}),
				],
			}),
		).toBe(false);
	});

	test("goes by the bounding box when there is one", () => {
		const box = (x1: number, y1: number) =>
			scan({
				boundingBox: {
					x0: 0,
					y0: 0,
					x1,
					y1,
				},
			});
		expect(
			pageScan({
				dimensions: A4,
				images: [
					box(595, 842),
				],
			}),
		).toBe(true);
		expect(
			pageScan({
				dimensions: A4,
				images: [
					box(400, 842),
				],
			}),
		).toBe(false);
	});

	test("gives a passage read by OCR on a scanned page that page", () => {
		const text =
			"Owners clear the pavement in front of their property by seven in the morning. The cleared path is at least one metre wide.";
		const result = document({
			dimensions: A4,
			images: [
				scan({
					ocrResult: ocrResult(text.replace("seven", "seven\n")),
				}),
			],
		});
		const artifact = createExtractionArtifact({
			result: {
				...result,
				content: `${text}\n`,
				chunks: [
					{
						content: text,
						metadata: {
							byteStart: 0,
							byteEnd: 0,
							chunkIndex: 0,
							totalChunks: 1,
						},
					},
				],
			},
		});

		expect(artifact.chunks[0]?.metadata).toMatchObject({
			firstPage: 1,
			lastPage: 1,
		});
	});
});
