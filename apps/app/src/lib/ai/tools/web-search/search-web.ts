import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import type { MeteredWebSearch } from "./metered-web-search";
import { type SearchWebOutput, searchWebModelOutput } from "./outputs";
import { searchWebInputSchema } from "./search-web.declaration";

const WEB_SEARCH_MAX_RESULTS = 5;

export const searchWebTool = ({
	search,
	allowedDomains,
}: {
	search: MeteredWebSearch;
	allowedDomains: readonly string[];
}) =>
	effectTool({
		description: [
			"Search the web and return the best matching pages, each in a <web-result> tag with its ref, title and url around the text that matches the query.",
			"Use it for current events, facts you are unsure of, and anything after your knowledge cutoff.",
			...(allowedDomains.length > 0
				? [
						`Only pages on ${allowedDomains.join(", ")} and their subdomains are returned.`,
					]
				: []),
		].join(" "),
		inputSchema: searchWebInputSchema,
		toModelOutput: searchWebModelOutput,
		run: ({ query }, { abortSignal }) =>
			search(
				{
					query,
					allowedDomains,
					maxResults: WEB_SEARCH_MAX_RESULTS,
				},
				abortSignal,
			).pipe(
				Effect.map(
					(results): SearchWebOutput => ({
						results: results.map(({ url, title, content }) => ({
							url,
							title,
							content,
						})),
					}),
				),
			),
	});
