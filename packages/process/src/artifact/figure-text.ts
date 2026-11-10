import type { ExtractionResult } from "@kreuzberg/node";

type Chunk = NonNullable<ExtractionResult["chunks"]>[number];
type Range = [
	number,
	number,
];

const FIGURE_PLACEHOLDER = /!\[[^\]]*\]\(image_(\d+)\.\w+\)/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const ASCII_PUNCTUATION = /^[!-/:-@[-`{-~]$/;
/** How many letters past the end of a chunk the next one may start. */
const CHUNK_GAP = 16;

/** Every character but whitespace, so a figure's text matches only as it was read. */
const exactly = (char: string) => (/\s/u.test(char) ? "" : char);

/** Letters and digits only, which match however the chunker re-renders the Markdown. */
const lettersOnly = (char: string) =>
	char
		.normalize("NFKC")
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}]/gu, "");

/**
 * `text` outside image placeholders and Markdown escapes as `keep` reduces each
 * character, with the range in `text` that each UTF-16 unit of it comes from.
 */
const reduce = (text: string, keep: (char: string) => string) => {
	const placeholders = [
		...text.matchAll(IMAGE),
	].map(
		(match): Range => [
			match.index,
			match.index + match[0].length,
		],
	);
	let reduced = "";
	const starts: number[] = [];
	const ends: number[] = [];
	let placeholder = 0;
	let position = 0;
	while (position < text.length) {
		const [start, end] = placeholders[placeholder] ?? [
			text.length,
			text.length,
		];
		if (position >= start) {
			position = end;
			placeholder++;
			continue;
		}
		const char = String.fromCodePoint(text.codePointAt(position) as number);
		const next = position + char.length;
		if (char === "\\" && ASCII_PUNCTUATION.test(text[next] ?? "")) {
			position = next;
			continue;
		}
		const kept = keep(char);
		reduced += kept;
		for (let unit = 0; unit < kept.length; unit++) {
			starts.push(position);
			ends.push(next);
		}
		position = next;
	}
	return {
		text: reduced,
		starts,
		ends,
		placeholders,
	};
};

type Reduced = ReturnType<typeof reduce>;

/** The index of the first unit of `reduced` that comes from `position` or later. */
const firstFrom = (reduced: Reduced, position: number) => {
	let low = 0;
	let high = reduced.starts.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (reduced.starts[middle] < position) low = middle + 1;
		else high = middle;
	}
	return low;
};

/** Back over the whitespace before `start`, but not past `floor`. */
const backOverSpace = (text: string, start: number, floor: number) => {
	let position = start;
	while (position > floor && /\s/.test(text[position - 1])) position--;
	return position;
};

/**
 * The ranges of `text` that hold a figure's whole OCR text, as it was read
 * apart from whitespace, right after the figure's placeholder, with the blank
 * lines before it.
 */
const figureBlocks = (text: string, figures: ReadonlyMap<number, string>) => {
	const exact = reduce(text, exactly);
	const blocks: Range[] = [];
	for (const placeholder of text.matchAll(FIGURE_PLACEHOLDER)) {
		const figure = figures.get(Number(placeholder[1]));
		if (!figure) continue;
		const after = placeholder.index + placeholder[0].length;
		const first = firstFrom(exact, after);
		if (!exact.text.startsWith(figure, first)) continue;
		const start = exact.starts[first];
		const end = exact.ends[first + figure.length - 1];
		if (
			exact.placeholders.some(
				([placeholderStart]) =>
					placeholderStart >= after && placeholderStart < end,
			)
		)
			continue;
		blocks.push([
			backOverSpace(text, start, after),
			end,
		]);
	}
	return blocks.sort(([a], [b]) => a - b);
};

/** `text` without `cuts`, which are in order. */
const cutOut = (text: string, cuts: readonly Range[]) => {
	let kept = "";
	let position = 0;
	for (const [start, end] of cuts) {
		if (end <= position) continue;
		kept += text.slice(position, Math.max(position, start));
		position = end;
	}
	return kept + text.slice(position);
};

/**
 * Where `chunk` starts in `content`: its one occurrence from the previous
 * chunk's start to a little past its end, or else its one occurrence anywhere.
 * Undefined when that is ambiguous.
 */
const placeChunk = (
	content: string,
	chunk: string,
	window: Range | undefined,
) => {
	if (window) {
		const at = content.indexOf(chunk, window[0]);
		if (at >= 0 && at <= window[1]) {
			const next = content.indexOf(chunk, at + 1);
			return next < 0 || next > window[1] ? at : undefined;
		}
	}
	const at = content.indexOf(chunk);
	return at >= 0 && content.indexOf(chunk, at + 1) < 0 ? at : undefined;
};

/** Past the table pipes and punctuation that end the line after `end`. */
const lineEnd = (text: string, end: number) => {
	let position = end;
	while (position < text.length && text[position] !== "\n") {
		const char = String.fromCodePoint(text.codePointAt(position) as number);
		if (lettersOnly(char)) break;
		position += char.length;
	}
	return position;
};

/**
 * The ranges of a chunk its figure letters come from: from the start of the
 * first one's line, with the blank lines before it, to the end of the last
 * one's line, around the placeholders between them and the line breaks before
 * those.
 */
const chunkCuts = (text: string, letters: Reduced, runs: readonly Range[]) =>
	runs.flatMap(([first, last]) => {
		let floor = first > 0 ? letters.ends[first - 1] : 0;
		for (const [, end] of letters.placeholders)
			if (end <= letters.starts[first]) floor = Math.max(floor, end);
		let start = letters.starts[first];
		while (start > floor && text[start - 1] !== "\n") start--;
		start = backOverSpace(text, start, floor);
		const end = lineEnd(text, letters.ends[last - 1]);

		const cuts: Range[] = [];
		for (const [placeholderStart, placeholderEnd] of letters.placeholders) {
			if (placeholderStart < start || placeholderEnd > end) continue;
			cuts.push([
				start,
				backOverSpace(text, placeholderStart, start),
			]);
			start = placeholderEnd;
		}
		cuts.push([
			start,
			end,
		]);
		return cuts;
	});

/**
 * Each chunk without what it shares with the figure blocks of the content,
 * found by placing the chunk's letters in the content's. A chunk that cannot
 * be placed for certain stays as it is.
 */
const chunksWithoutFigureText = (
	chunks: readonly Chunk[],
	content: Reduced,
	isFigure: Uint8Array,
) => {
	const kept: Chunk[] = [];
	let window: Range | undefined = [
		0,
		CHUNK_GAP,
	];
	for (const chunk of chunks) {
		const letters = reduce(chunk.content, lettersOnly);
		if (!letters.text) {
			kept.push(chunk);
			continue;
		}
		const at = placeChunk(content.text, letters.text, window);
		window =
			at === undefined
				? undefined
				: [
						at,
						at + letters.text.length + CHUNK_GAP,
					];
		const runs: Range[] = [];
		if (at !== undefined) {
			for (let index = 0; index < letters.text.length; index++) {
				if (!isFigure[at + index]) continue;
				const last = runs.at(-1);
				if (last && last[1] === index) last[1] = index + 1;
				else
					runs.push([
						index,
						index + 1,
					]);
			}
		}
		if (runs.length === 0) {
			kept.push(chunk);
			continue;
		}
		const text = cutOut(
			chunk.content,
			chunkCuts(chunk.content, letters, runs),
		).trim();
		if (text)
			kept.push({
				...chunk,
				content: text,
			});
	}
	return kept.map(
		(chunk, index): Chunk => ({
			...chunk,
			metadata: {
				...chunk.metadata,
				chunkIndex: index,
				totalChunks: kept.length,
			},
		}),
	);
};

/**
 * Kreuzberg reads the text in every figure and puts it after the figure's
 * placeholder, where it would be indexed as document text. This takes it out
 * of the content, the page texts and the chunks. Only a figure's whole text
 * right after its placeholder goes, so anything that merely resembles it
 * stays. Text read from a scanned page has no placeholder and stays too.
 */
export const withoutFigureText = (
	result: ExtractionResult,
): ExtractionResult => {
	const figures = new Map<number, string>();
	for (const image of result.images ?? []) {
		const text = reduce(image.ocrResult?.content ?? "", exactly).text;
		if (text) figures.set(image.imageIndex, text);
	}
	if (figures.size === 0) return result;

	const blocks = figureBlocks(result.content, figures);
	if (blocks.length === 0) return result;
	const letters = reduce(result.content, lettersOnly);
	const isFigure = new Uint8Array(letters.text.length);
	let block = 0;
	for (let index = 0; index < letters.text.length; index++) {
		while (block < blocks.length && blocks[block][1] <= letters.starts[index])
			block++;
		if (block < blocks.length && letters.starts[index] >= blocks[block][0])
			isFigure[index] = 1;
	}

	return {
		...result,
		content: cutOut(result.content, blocks),
		pages: result.pages?.map((page) => ({
			...page,
			content: cutOut(page.content, figureBlocks(page.content, figures)),
		})),
		chunks:
			result.chunks &&
			chunksWithoutFigureText(result.chunks, letters, isFigure),
	};
};
