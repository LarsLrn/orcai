import { safeExternalUrl } from "@orcai/core";
import { searchWebOutputSchema } from "./outputs";

/** Markdown link targets and bare URLs, either with balanced parentheses such as `/Orca_(band)`. */
const LINKED_URL =
	/\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)|(https?:\/\/(?:[^\s<>()[\]]|\([^\s<>()[\]]*\))+)/g;

const linkedUrls = (text: string) =>
	new Set(
		Array.from(text.matchAll(LINKED_URL), ([, target, bare]) =>
			(target ?? bare ?? "").replace(/[.,;:!?]+$/, ""),
		),
	);

export interface CitedWebSource {
	url: string;
	title?: string;
}

/**
 * The web pages a reply cites, in order: the URL sources the model's own
 * search attached, then the `searchWeb` results the reply's text links to.
 * Only http and https URLs without credentials count.
 */
export const citedWebSources = (
	parts: readonly {
		type: string;
	}[],
): CitedWebSource[] => {
	const linked = linkedUrls(
		parts
			.flatMap((part) =>
				part.type === "text" && "text" in part && typeof part.text === "string"
					? [
							part.text,
						]
					: [],
			)
			.join("\n"),
	);
	const sources = new Map<string, CitedWebSource>();

	for (const part of parts) {
		if (
			part.type === "source-url" &&
			"url" in part &&
			typeof part.url === "string" &&
			safeExternalUrl(part.url)
		) {
			sources.set(part.url, {
				url: part.url,
				title:
					"title" in part && typeof part.title === "string"
						? part.title
						: sources.get(part.url)?.title,
			});
		}
		if (part.type === "tool-searchWeb" && "output" in part) {
			for (const result of searchWebOutputSchema.safeParse(part.output).data
				?.results ?? []) {
				if (
					linked.has(result.url) &&
					!sources.has(result.url) &&
					safeExternalUrl(result.url)
				) {
					sources.set(result.url, {
						url: result.url,
						title: result.title,
					});
				}
			}
		}
	}

	return [
		...sources.values(),
	];
};
