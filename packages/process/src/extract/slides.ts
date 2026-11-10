import { type ExtractionResult, extractBytes } from "@kreuzberg/node";
import * as Effect from "effect/Effect";
import { ProcessError } from "../errors";
import type {
	ExpandedExtractionConfig,
	ExpandedMetadata,
} from "../kreuzberg-expanded-types";

type Chunk = NonNullable<ExtractionResult["chunks"]>[number];

/**
 * Each slide's text from `content` read with `marker` before every slide, or
 * undefined unless the markers number the slides 1 to `count` in order with
 * nothing before the first.
 */
const splitSlides = (content: string, marker: string, count: number) => {
	const parts = content.split(new RegExp(`^${marker}(\\d+)$`, "m"));
	const slides = Array.from(
		{
			length: (parts.length - 1) / 2,
		},
		(_, index) => ({
			pageNumber: Number(parts[1 + index * 2]),
			content: parts[2 + index * 2].trim(),
			tables: [],
			images: [],
		}),
	);
	return parts[0].trim() === "" &&
		slides.length === count &&
		slides.every(({ pageNumber }, index) => pageNumber === index + 1)
		? slides
		: undefined;
};

/** Whether extraction read the document as slides. */
export const isSlideDeck = (result: ExtractionResult) =>
	(result.metadata as ExpandedMetadata).pages?.unitType === "slide";

const read = (data: Uint8Array, mimeType: string, config: object) =>
	Effect.tryPromise({
		try: () => extractBytes(Buffer.from(data), mimeType, config),
		catch: (cause) =>
			new ProcessError({
				operation: "extractBytes",
				cause,
			}),
	});

/**
 * The deck with each slide's text and its chunks taken slide by slide, so no
 * chunk spans two slides. Extraction returns no text per slide and page
 * boundaries that drift from the Markdown, so the slides are read once more
 * with a marker before each.
 */
export const chunkSlides = (params: {
	result: ExtractionResult;
	data: Uint8Array;
	mimeType: string;
	config: ExpandedExtractionConfig;
}) =>
	Effect.gen(function* () {
		// Unpredictable, so no text of the deck reads as a marker.
		const marker = `ORCASLIDE${crypto.randomUUID().replaceAll("-", "")}PAGE`;
		const marked = yield* read(params.data, params.mimeType, {
			useCache: false,
			outputFormat: "markdown",
			images: {
				extractImages: false,
			},
			pages: {
				insertPageMarkers: true,
				markerFormat: `\n\n${marker}{page_num}\n\n`,
			},
		} satisfies ExpandedExtractionConfig);
		const count =
			(params.result.metadata as ExpandedMetadata).pages?.totalCount ?? 0;
		const slides = splitSlides(marked.content, marker, count);
		if (!slides) {
			// Some formats (PPT) are read as slides without markers: keep their chunks whole, without pages.
			yield* Effect.logWarning(
				{
					mimeType: params.mimeType,
					slideCount: count,
				},
				"Could not split the slide deck at its slides; keeping its chunks unsplit",
			);
			const unsplit: ExtractionResult = {
				...params.result,
				chunks: (params.result.chunks ?? []).map((chunk) => ({
					...chunk,
					metadata: {
						...chunk.metadata,
						firstPage: null,
						lastPage: null,
					},
				})),
			};
			return unsplit;
		}

		const perSlide = yield* Effect.forEach(slides, (slide) =>
			slide.content.length === 0
				? Effect.succeed<Chunk[]>([])
				: read(Buffer.from(slide.content, "utf-8"), "text/markdown", {
						useCache: false,
						outputFormat: "markdown",
						chunking: params.config.chunking,
					} satisfies ExpandedExtractionConfig).pipe(
						Effect.map(({ chunks }) =>
							(chunks ?? []).map((chunk) => ({
								...chunk,
								metadata: {
									...chunk.metadata,
									firstPage: slide.pageNumber,
									lastPage: slide.pageNumber,
								},
							})),
						),
					),
		);
		const chunks = perSlide.flat();

		const deck: ExtractionResult = {
			...params.result,
			pages: slides,
			chunks: chunks.map((chunk, chunkIndex) => ({
				...chunk,
				metadata: {
					...chunk.metadata,
					chunkIndex,
					totalChunks: chunks.length,
				},
			})),
		};
		return deck;
	});
