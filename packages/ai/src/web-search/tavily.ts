import { z } from "zod/v4";
import type { ProviderConnection } from "../provider-kinds/types";
import { type WebSearch, WebSearchError } from "./types";

const DEFAULT_ENDPOINT = "https://api.tavily.com";

/** Tavily answers basic searches in about a second; a hung request must not hold the turn. */
const TIMEOUT_MS = 20_000;

const responseSchema = z.object({
	results: z.array(
		z.object({
			url: z.string(),
			title: z.string(),
			content: z.string(),
		}),
	),
});

const errorSchema = z.object({
	detail: z.object({
		error: z.string(),
	}),
});

const failureMessage = async (response: Response) => {
	const body = errorSchema.safeParse(
		await response.json().catch(() => undefined),
	);
	return body.success
		? body.data.detail.error
		: `Tavily answered ${response.status} ${response.statusText}`;
};

/** Tavily's search, at basic depth: one credit per search. */
export const tavilyWebSearch =
	({
		apiKey,
		endpoint,
		fetch = globalThis.fetch,
	}: ProviderConnection): WebSearch =>
	async ({ query, allowedDomains, maxResults }, options) => {
		const response = await fetch(
			`${(endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "")}/search`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${apiKey}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					query,
					search_depth: "basic",
					topic: "general",
					max_results: maxResults,
					...(allowedDomains.length > 0 && {
						include_domains: allowedDomains,
					}),
				}),
				signal: options?.signal
					? AbortSignal.any([
							options.signal,
							AbortSignal.timeout(TIMEOUT_MS),
						])
					: AbortSignal.timeout(TIMEOUT_MS),
			},
		).catch((cause: unknown) => {
			throw new WebSearchError(
				cause instanceof Error ? cause.message : "Tavily could not be reached",
			);
		});

		if (!response.ok) {
			throw new WebSearchError(await failureMessage(response), response.status);
		}

		const body = responseSchema.safeParse(await response.json());
		if (!body.success) {
			throw new WebSearchError("Tavily answered with an unexpected body");
		}
		return body.data.results;
	};
