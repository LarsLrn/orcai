import type { ToolResultPart } from "ai";
import { z } from "zod/v4";
import {
	type KnowledgeBaseDocument,
	knowledgeBaseDocumentSchema,
	type Passage,
	passageSchema,
} from "./types";

/** What the knowledge base tools store; a stored output of an older shape fails to parse. */
export const searchOutputSchema = z.object({
	results: z.array(passageSchema),
});

export const chunksOutputSchema = z.object({
	passages: z.array(passageSchema),
	missing: z.array(z.string()).optional(),
});

export const pageOutputSchema = z.object({
	passages: z.array(passageSchema),
	matchedDocuments: z.array(knowledgeBaseDocumentSchema).optional(),
});

export const listOutputSchema = z.object({
	documents: z.array(knowledgeBaseDocumentSchema),
});

const pagesLabel = ({ pageStart, pageEnd }: Passage) => {
	if (pageStart === undefined) {
		return undefined;
	}

	return pageEnd === undefined || pageEnd === pageStart
		? `p. ${pageStart}`
		: `pp. ${pageStart}-${pageEnd}`;
};

const passageText = (passage: Passage) =>
	[
		[
			`[${passage.id}] ${passage.title} (asset ${passage.assetId})`,
			pagesLabel(passage),
		]
			.filter(Boolean)
			.join(", "),
		passage.text,
	].join("\n");

const passagesText = (passages: Passage[]) =>
	passages.length > 0
		? passages.map(passageText).join("\n\n")
		: "No matching passages.";

const documentsText = (documents: KnowledgeBaseDocument[]) =>
	documents.length > 0
		? documents
				.map(
					({ assetId, title, citation }) =>
						`- ${assetId}: ${title}${citation ? ` (${citation})` : ""}`,
				)
				.join("\n")
		: "No documents.";

/** The model reads `render`'s text; an output of an older shape is gone for it. */
const modelText =
	<Schema extends z.ZodType>(
		schema: Schema,
		render: (output: z.infer<Schema>) => string,
	) =>
	({ output }: { output: unknown }): ToolResultPart["output"] => {
		const parsed = schema.safeParse(output);

		return {
			type: "text",
			value: parsed.success
				? render(parsed.data)
				: "Output no longer available",
		};
	};

export const searchModelOutput = modelText(searchOutputSchema, ({ results }) =>
	passagesText(results),
);

export const chunksModelOutput = modelText(
	chunksOutputSchema,
	({ passages, missing }) =>
		[
			passagesText(passages),
			...(missing && missing.length > 0
				? [
						`Not found: ${missing.join(", ")}`,
					]
				: []),
		].join("\n\n"),
);

export const pageModelOutput = modelText(
	pageOutputSchema,
	({ passages, matchedDocuments }) =>
		[
			passagesText(passages),
			...(matchedDocuments && matchedDocuments.length > 0
				? [
						`Matching documents:\n${documentsText(matchedDocuments)}`,
					]
				: []),
		].join("\n\n"),
);

export const listModelOutput = modelText(listOutputSchema, ({ documents }) =>
	documentsText(documents),
);
