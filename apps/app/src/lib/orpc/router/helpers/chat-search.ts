import type { ChatSearchSnippet } from "@orcai/schema";

const MARK_START = "\u0002";
const MARK_STOP = "\u0003";

/** `ts_headline` options: one short fragment, matches between the marks {@link snippetOf} reads. */
export const HEADLINE_OPTIONS = `StartSel=${MARK_START}, StopSel=${MARK_STOP}, MaxWords=24, MinWords=12, ShortWord=0, MaxFragments=1`;

/**
 * A `to_tsquery` source matching every term, the last one as a prefix so
 * results follow typing. Terms are quoted, so operators in the input stay text.
 */
export const prefixTsQuery = (search: string): string | undefined => {
	const terms = search.split(/\s+/).filter((term) => term.length > 0);
	if (terms.length === 0) return undefined;

	return terms
		.map((term, index) => {
			const literal = `'${term.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
			return index === terms.length - 1 ? `${literal}:*` : literal;
		})
		.join(" & ");
};

/** A headline as text segments, the matched ones highlighted. */
export const snippetOf = (headline: string): ChatSearchSnippet =>
	headline
		.split(MARK_START)
		.flatMap((chunk, index) => {
			if (index === 0) {
				return [
					{
						text: chunk,
						highlighted: false,
					},
				];
			}
			const [match = "", rest = ""] = chunk.split(MARK_STOP);
			return [
				{
					text: match,
					highlighted: true,
				},
				{
					text: rest,
					highlighted: false,
				},
			];
		})
		.filter((segment) => segment.text.length > 0);
