import { safeExternalUrl } from "@orcai/core";
import type { ToolResultPart } from "ai";
import { z } from "zod/v4";
import { type Source, sourceRef } from "@/lib/ai/citations/source-ref";
import { dataTag } from "@/lib/ai/utils/data-tag";

/** What `searchWeb` answers with, as the browser reads it back. */
export const searchWebOutputSchema = z.object({
	results: z.array(
		z.object({
			url: z.string(),
			title: z.string(),
			content: z.string(),
		}),
	),
});

export type SearchWebOutput = z.infer<typeof searchWebOutputSchema>;

type WebResult = SearchWebOutput["results"][number];

/** A result's ref; none for a URL the app does not open. */
const resultRef = ({ url }: WebResult) =>
	safeExternalUrl(url) ? sourceRef("web", url) : undefined;

/** The results a reply may cite, each by its URL as the search returned it. */
export const webSources = (output: unknown): Source[] =>
	(searchWebOutputSchema.safeParse(output).data?.results ?? []).flatMap(
		(result) => {
			const ref = resultRef(result);

			return ref
				? [
						{
							ref,
							identity: result.url,
							citation: {
								kind: "web",
								url: result.url,
								title: result.title,
							},
						},
					]
				: [];
		},
	);

export const searchWebModelOutput = ({
	output,
}: {
	output: unknown;
}): ToolResultPart["output"] => {
	const parsed = searchWebOutputSchema.safeParse(output);
	if (!parsed.success) {
		return {
			type: "text",
			value: "Output no longer available",
		};
	}
	const { results } = parsed.data;

	return {
		type: "text",
		value:
			results.length > 0
				? results
						.map((result) =>
							dataTag(
								"web-result",
								{
									ref: resultRef(result),
									title: result.title,
									url: result.url,
								},
								result.content,
							),
						)
						.join("\n\n")
				: "No matching pages.",
	};
};
