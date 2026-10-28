import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import type { MeteredWebSearch } from "./metered-web-search";
import type { SearchWebOutput } from "./outputs";

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
			"Search the web and return the best matching pages with their url, title and the text that matches the query.",
			"Use it for current events, facts you are unsure of, and anything after your knowledge cutoff.",
			"Cite every page you use with a Markdown link to its url.",
			...(allowedDomains.length > 0
				? [
						`Only pages on ${allowedDomains.join(", ")} and their subdomains are returned.`,
					]
				: []),
		].join(" "),
		inputSchema: z.strictObject({
			query: z
				.string()
				.trim()
				.min(2)
				.max(400)
				.describe(
					"What to search for, as you would type it into a search engine.",
				),
		}),
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
