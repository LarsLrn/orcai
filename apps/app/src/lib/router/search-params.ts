import { stringifySearchWith } from "@tanstack/react-router";

/** Values the router writes as JSON: quoted strings, arrays and objects. */
const json = /^["[{]/;

const parseJson = (value: string): unknown => {
	if (!json.test(value)) throw new SyntaxError("Not a JSON search value");
	return JSON.parse(value);
};

const parseValue = (value: string): unknown => {
	try {
		return parseJson(value);
	} catch {
		return value;
	}
};

/**
 * Reads search params keeping plain values as the strings they are, so a
 * query such as "2024" or "true" stays text; the router's default turns them
 * into a number and a boolean. Route schemas coerce the numbers and booleans
 * they expect.
 */
export const parseSearch = (searchStr: string) =>
	Object.fromEntries(
		[
			...new URLSearchParams(searchStr),
		].map(([key, value]) => [
			key,
			parseValue(value),
		]),
	);

/** Writes search params {@link parseSearch} reads back unchanged. */
export const stringifySearch = stringifySearchWith(JSON.stringify, parseJson);
