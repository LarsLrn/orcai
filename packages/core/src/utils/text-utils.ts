/**
 * Normalizes a string for consistent text comparison:
 *   - Lowercases all characters.
 *   - Replaces any character that is not a Unicode letter, digit, or
 *     whitespace with a space (removes punctuation, symbols, etc.).
 *   - Collapses consecutive whitespace into a single space.
 *   - Trims leading/trailing whitespace.
 */
export const normalizeText = (value: string) =>
	value
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}\s]/gu, " ")
		.replaceAll(/\s+/g, " ")
		.trim();

/**
 * Splits a string into an array of normalized tokens, discarding any
 * single-character tokens (noise characters that survive normalization).
 */
export const tokenize = (value: string): string[] =>
	normalizeText(value)
		.split(" ")
		.filter((token) => token.length > 1);

const graphemes = new Intl.Segmenter(undefined, {
	granularity: "grapheme",
});

const firstGrapheme = (word: string) =>
	graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? "";

/** Up to two letters for a name: the first of its first and last words. */
export const initialsOf = (name: string | undefined | null) => {
	const words = (name ?? "").trim().split(/\s+/u).filter(Boolean);
	const first = words.at(0);
	const last = words.length > 1 ? words.at(-1) : undefined;
	return [
		first,
		last,
	]
		.map((word) => (word ? firstGrapheme(word) : ""))
		.join("")
		.toLocaleUpperCase();
};

/** The form an email address is stored and compared in. */
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
