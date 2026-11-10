import { describe, expect, test } from "bun:test";
import { extractBytes } from "@kreuzberg/node";
import { pptxWithSlides } from "@orcai/testing/documents";
import * as Effect from "effect/Effect";
import { createExtractionArtifact } from "../../src/artifact/storage";
import { getExtractionProfileConfig } from "../../src/extract/profiles";
import { chunkSlides } from "../../src/extract/slides";

const PPTX =
	"application/vnd.openxmlformats-officedocument.presentationml.presentation";

const slides = [
	{
		title: "Methods workshop",
		lines: [
			"Qualitative content analysis, session three.",
		],
	},
	{
		title: "Category system",
		lines: [
			"Deductive categories come from theory.",
			"ORCAISLIDE3",
			"ORCASLIDE0a1b2c3PAGE3",
		],
	},
	{
		title: "Survey response",
		lines: [
			"The online survey had 313 responses in total.",
		],
	},
];

const chunksOf = (result: {
	chunks?:
		| {
				content: string;
				metadata: {
					firstPage?: number | null;
					lastPage?: number | null;
				};
		  }[]
		| null;
}) =>
	(result.chunks ?? []).map(({ content, metadata }) => ({
		content,
		pages: [
			metadata.firstPage,
			metadata.lastPage,
		],
	}));

const config = {
	...getExtractionProfileConfig(),
	useCache: false,
};

describe("slide decks", () => {
	test("a deck is chunked slide by slide, and lines that read like markers stay text", async () => {
		const deck = pptxWithSlides(slides);
		const result = await Effect.runPromise(
			chunkSlides({
				result: await extractBytes(deck, PPTX, config),
				data: new Uint8Array(deck),
				mimeType: PPTX,
				config,
			}),
		);

		expect(chunksOf(result)).toEqual(
			slides.map(({ title, lines }, index) => ({
				content: [
					`## ${title}`,
					...lines,
				].join("\n\n"),
				pages: [
					index + 1,
					index + 1,
				],
			})),
		);
		expect(result.pages?.map(({ pageNumber }) => pageNumber)).toEqual([
			1,
			2,
			3,
		]);
	});

	test("a deck whose slides cannot be told apart keeps its chunks, without pages", async () => {
		const deck = pptxWithSlides(slides);
		const firstPass = await extractBytes(deck, PPTX, config);

		// The second read numbers two slides where the first counted three, as a PPT file reads without markers.
		const result = await Effect.runPromise(
			chunkSlides({
				result: firstPass,
				data: new Uint8Array(pptxWithSlides(slides.slice(0, 2))),
				mimeType: PPTX,
				config,
			}),
		);

		expect(chunksOf(result)).toEqual(
			(firstPass.chunks ?? []).map(({ content }) => ({
				content,
				pages: [
					null,
					null,
				],
			})),
		);
		expect(result.chunks?.length).toBeGreaterThan(0);
	});

	test("a deck that was not read slide by slide stores its chunks without pages", async () => {
		const firstPass = await extractBytes(pptxWithSlides(slides), PPTX, config);

		const artifact = createExtractionArtifact({
			result: firstPass,
		});

		expect(artifact.chunks.length).toBeGreaterThan(0);
		expect(
			artifact.chunks.map(({ metadata }) => [
				metadata.firstPage,
				metadata.lastPage,
			]),
		).toEqual(
			artifact.chunks.map(() => [
				null,
				null,
			]),
		);
	});
});
