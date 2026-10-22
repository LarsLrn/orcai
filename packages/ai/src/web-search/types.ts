export interface WebSearchQuery {
	readonly query: string;
	/** Host names whose pages, subdomains included, may be returned; empty allows the whole web. */
	readonly allowedDomains: readonly string[];
	readonly maxResults: number;
}

export interface WebSearchResult {
	readonly url: string;
	readonly title: string;
	/** What the page says about the query, enough to answer from. */
	readonly content: string;
}

/** A search provider's failure, with the message the provider gave. */
export class WebSearchError extends Error {
	override readonly name = "WebSearchError";

	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
	}
}

/** Runs one search; rejects with a `WebSearchError`. */
export type WebSearch = (
	query: WebSearchQuery,
	options?: {
		signal?: AbortSignal;
	},
) => Promise<WebSearchResult[]>;
