import { docsMarkdownPath } from "@orcai/core";
import type { ToolResultPart } from "ai";
import { z } from "zod/v4";
import { type Source, sourceRef } from "@/lib/ai/citations/source-ref";
import { dataTag } from "@/lib/ai/utils/data-tag";

/** What `readDocs` answers with: the index without a path, a page with one. */
const readDocsOutputSchema = z.object({
	path: z.string().nullable(),
	title: z.string().nullable(),
	url: z.string(),
	content: z.string(),
});

type ReadDocsOutput = z.infer<typeof readDocsOutputSchema>;

/** A read page's path as `docsMarkdownPath` writes it; none for the index. */
const pagePath = ({ path }: ReadDocsOutput) =>
	path === null ? undefined : docsMarkdownPath(path)?.path;

/** The page a reply may cite, by its path; the index issues none. */
export const docsSources = (output: unknown): Source[] => {
	const parsed = readDocsOutputSchema.safeParse(output).data;
	const path = parsed && pagePath(parsed);

	return parsed && path
		? [
				{
					ref: sourceRef("docs", path),
					identity: path,
					citation: {
						kind: "docs",
						path,
						title: parsed.title ?? path,
					},
				},
			]
		: [];
};

export const readDocsModelOutput = ({
	output,
}: {
	output: unknown;
}): ToolResultPart["output"] => {
	const parsed = readDocsOutputSchema.safeParse(output);
	if (!parsed.success) {
		return {
			type: "text",
			value: "Output no longer available",
		};
	}
	const path = pagePath(parsed.data);

	return {
		type: "text",
		value: path
			? dataTag(
					"docs-page",
					{
						ref: sourceRef("docs", path),
						title: parsed.data.title ?? undefined,
						path,
					},
					parsed.data.content,
				)
			: parsed.data.content,
	};
};
