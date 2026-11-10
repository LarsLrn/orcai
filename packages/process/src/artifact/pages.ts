import type { ExtractionResult } from "@kreuzberg/node";
import type { ExpandedMetadata } from "../kreuzberg-expanded-types";

/** The text of one page, slide or sheet, as extraction read it. */
export type ExtractionPage = {
	pageNumber: number;
	content: string;
};

type Chunk = NonNullable<ExtractionResult["chunks"]>[number];

/** Long enough that text found once in the document is the chunk's own. */
const WINDOW = 32;
const STEP = WINDOW / 2;
const MIN_WINDOW = 12;
/** How close to each end of a chunk its text must be found. */
const EDGE = 2 * WINDOW;
/** The share of a chunk its found windows must cover, and the share its windows found only once must. */
const MIN_COVERAGE = 0.5;
const MIN_UNIQUE_COVERAGE = 0.25;

/** Letters and digits only, so line breaks, hyphenation, Markdown and words glued at line ends compare equal. */
const normalize = (text: string) =>
	text
		.replaceAll(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.normalize("NFKC")
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}]/gu, "");

/**
 * Each page's text: the pages extraction returns, or for formats without them
 * (presentations) the content between the page boundaries.
 */
export const extractionPages = (result: ExtractionResult): ExtractionPage[] => {
	if (result.pages && result.pages.length > 0) {
		return result.pages.map(({ pageNumber, content }) => ({
			pageNumber,
			content,
		}));
	}
	const boundaries = (result.metadata as ExpandedMetadata).pages?.boundaries;
	if (!boundaries) return [];
	const content = Buffer.from(result.content, "utf-8");
	return boundaries.map(({ pageNumber, byteStart, byteEnd }) => ({
		pageNumber,
		content: content.subarray(byteStart, byteEnd).toString("utf-8"),
	}));
};

const hashOf = (text: string, start: number) => {
	let hash = 0;
	for (let index = start; index < start + WINDOW; index++) {
		hash = (Math.imul(hash, 31) + text.charCodeAt(index)) | 0;
	}
	return hash;
};

/** The normalised text of every page in order, and where each window of it occurs. */
const indexPages = (pages: readonly ExtractionPage[]) => {
	const starts: number[] = [];
	let text = "";
	for (const page of pages) {
		starts.push(text.length);
		text += normalize(page.content);
	}

	const firstAt = new Map<number, number>();
	const repeated = new Set<number>();
	const power = Array.from({
		length: WINDOW - 1,
	}).reduce<number>((value) => Math.imul(value, 31), 1);
	let hash = text.length >= WINDOW ? hashOf(text, 0) : 0;
	for (let position = 0; position + WINDOW <= text.length; position++) {
		if (position > 0) {
			hash =
				(Math.imul(hash - Math.imul(text.charCodeAt(position - 1), power), 31) +
					text.charCodeAt(position + WINDOW - 1)) |
				0;
		}
		if (firstAt.has(hash)) repeated.add(hash);
		else firstAt.set(hash, position);
	}

	/** Where `window` occurs between `from` and `to`, if it occurs there exactly once. */
	const onceWithin = (window: string, from: number, to: number) => {
		const start = Math.max(0, from);
		const region = text.slice(start, to + window.length);
		const at = region.indexOf(window);
		return at !== -1 && region.indexOf(window, at + 1) === -1
			? start + at
			: undefined;
	};

	/** Where `window` occurs, if it occurs exactly once in the document. */
	const once = (window: string) => {
		if (window.length !== WINDOW) return onceWithin(window, 0, text.length);
		const key = hashOf(window, 0);
		const position = firstAt.get(key);
		return !repeated.has(key) &&
			position !== undefined &&
			text.startsWith(window, position)
			? position
			: undefined;
	};

	/** The index of the page that holds `position`. */
	const pageAt = (position: number) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = Math.ceil((low + high) / 2);
			if (starts[middle] <= position) low = middle;
			else high = middle - 1;
		}
		return low;
	};
	const endOf = (page: number) =>
		page + 1 < starts.length ? starts[page + 1] : text.length;

	return {
		starts,
		once,
		onceWithin,
		pageAt,
		endOf,
	};
};

type PageIndex = ReturnType<typeof indexPages>;

/** The share of a chunk of `length` that windows at `offsets` cover. */
const coverage = (
	offsets: readonly number[],
	width: number,
	length: number,
) => {
	let covered = 0;
	let end = 0;
	for (const offset of offsets) {
		covered += Math.max(0, offset + width - Math.max(offset, end));
		end = Math.max(end, offset + width);
	}
	return covered / length;
};

/**
 * The indexes of the first and last page the chunk's text lies on, or
 * undefined when that is uncertain: too little of it is found, or not near
 * both ends, a page in between has none of it, or an end that was not found
 * could lie on another page.
 */
const locate = (index: PageIndex, content: string) => {
	const text = normalize(content);
	const width = Math.min(WINDOW, text.length);
	if (width < MIN_WINDOW) return undefined;

	const offsets: number[] = [];
	for (let offset = 0; offset + width <= text.length; offset += STEP) {
		offsets.push(offset);
	}
	if (offsets.at(-1) !== text.length - width) {
		offsets.push(text.length - width);
	}
	const windowAt = (offset: number) => text.slice(offset, offset + width);

	const unique = offsets.flatMap((offset) => {
		const position = index.once(windowAt(offset));
		return position === undefined
			? []
			: [
					{
						offset,
						position,
					},
				];
	});
	if (
		coverage(
			unique.map(({ offset }) => offset),
			width,
			text.length,
		) < MIN_UNIQUE_COVERAGE
	) {
		return undefined;
	}
	const origins = unique
		.map(({ offset, position }) => position - offset)
		.sort((a, b) => a - b);
	const origin = origins[Math.floor(origins.length / 2)];

	// A repeated window counts where it occurs once near the place the unique ones put the chunk.
	const uniqueAt = new Map(
		unique.map(({ offset, position }) => [
			offset,
			position,
		]),
	);
	const hits = offsets.flatMap((offset) => {
		const position =
			uniqueAt.get(offset) ??
			index.onceWithin(
				windowAt(offset),
				origin + offset - text.length,
				origin + offset + text.length,
			);
		return position === undefined
			? []
			: [
					{
						offset,
						position,
					},
				];
	});
	const head = hits[0];
	const tail = hits[hits.length - 1];
	if (
		coverage(
			hits.map(({ offset }) => offset),
			width,
			text.length,
		) < MIN_COVERAGE ||
		head.offset > EDGE ||
		text.length - (tail.offset + width) > EDGE
	) {
		return undefined;
	}

	const covered = new Set<number>();
	for (const { position } of hits) {
		covered.add(index.pageAt(position));
		covered.add(index.pageAt(position + width - 1));
	}
	const first = Math.min(...covered);
	const last = Math.max(...covered);
	for (let page = first; page <= last; page++) {
		if (!covered.has(page) && index.endOf(page) > index.starts[page]) {
			return undefined;
		}
	}

	// The text before the first window found and after the last one may lie on the neighbouring page.
	const headPage = index.pageAt(head.position);
	if (headPage > 0 && head.position - head.offset < index.starts[headPage]) {
		return undefined;
	}
	const tailPage = index.pageAt(tail.position + width - 1);
	if (
		tailPage < index.starts.length - 1 &&
		tail.position + text.length - tail.offset > index.endOf(tailPage)
	) {
		return undefined;
	}

	return {
		first,
		last,
	};
};

/**
 * The chunks with the pages their text lies on, found by matching it against
 * each page's text; a chunk that cannot be placed with certainty has none.
 */
export const placeChunks = (
	chunks: readonly Chunk[],
	pages: readonly ExtractionPage[],
): Chunk[] => {
	const index = pages.length > 0 ? indexPages(pages) : undefined;
	return chunks.map((chunk) => {
		const placed = index && locate(index, chunk.content);
		return {
			...chunk,
			metadata: {
				...chunk.metadata,
				firstPage: placed ? pages[placed.first].pageNumber : null,
				lastPage: placed ? pages[placed.last].pageNumber : null,
			},
		};
	});
};
