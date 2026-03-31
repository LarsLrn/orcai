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

export const getInitial = (value: string | undefined | null) => {
	let initial = "U";

	if (value && value.length > 0) {
		initial = value[0].toUpperCase();
	}

	return initial;
};
