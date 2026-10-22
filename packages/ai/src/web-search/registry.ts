import type { SearchProviderKind } from "@orcai/core";
import type { ProviderConnection } from "../provider-kinds/types";
import { isAllowedUrl } from "./allowed-domains";
import { tavilyWebSearch } from "./tavily";
import type { WebSearch } from "./types";

const searchProviderKindEntries: Record<
	SearchProviderKind,
	(connection: ProviderConnection) => WebSearch
> = {
	tavily: tavilyWebSearch,
};

/**
 * The search of a provider row. Whatever the provider returns, results stay
 * within the allowed domains and the requested count.
 */
export const createWebSearch =
	(kind: SearchProviderKind, connection: ProviderConnection): WebSearch =>
	async (query, options) => {
		const results = await searchProviderKindEntries[kind](connection)(
			query,
			options,
		);
		return results
			.filter(({ url }) => isAllowedUrl(url, query.allowedDomains))
			.slice(0, query.maxResults);
	};
