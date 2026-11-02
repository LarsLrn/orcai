import { safeExternalUrl } from "@orcai/core";
import type { ChatMessageCitation } from "@orcai/schema";
import type { UIMessage } from "ai";

export interface CitedWebSource {
	url: string;
	title?: string;
}

/**
 * The web pages a reply cites, in order: its web citations, then the pages
 * the model's own search cites in the text. Pages it only retrieved do not
 * count, nor do URLs other than http and https without credentials.
 */
export const citedWebSources = (
	parts: UIMessage["parts"],
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
		if (part.type === "text") {
			for (const { source } of part.citations ?? []) {
				if (source.sourceType === "url") {
					add(source.url, source.title);
				}
			}
		}
	}

	return [
		...sources.values(),
	];
};
