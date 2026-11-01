import { safeExternalUrl } from "@orcai/core";
import type { ChatMessageCitation } from "@orcai/schema";

export interface CitedWebSource {
	url: string;
	title?: string;
}

/**
 * The web pages a reply cites, in order: its web citations, then the URL
 * sources the model's own search attached. Only http and https URLs without
 * credentials count.
 */
export const citedWebSources = (
	parts: readonly {
		type: string;
	}[],
	citations: Readonly<Record<string, ChatMessageCitation | null>>,
): CitedWebSource[] => {
	const sources = new Map<string, CitedWebSource>();
	const add = (url: string, title: string | undefined) => {
		if (safeExternalUrl(url) && !sources.get(url)?.title) {
			sources.set(url, {
				url,
				title: title || undefined,
			});
		}
	};

	for (const citation of Object.values(citations)) {
		if (citation?.kind === "web") {
			add(citation.url, citation.title);
		}
	}
	for (const part of parts) {
		if (
			part.type === "source-url" &&
			"url" in part &&
			typeof part.url === "string"
		) {
			add(
				part.url,
				"title" in part && typeof part.title === "string"
					? part.title
					: undefined,
			);
		}
	}

	return [
		...sources.values(),
	];
};
