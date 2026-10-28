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
	notSearchable: z
		.array(
			z.object({
				note: z.string(),
			}),
		)
		.optional(),
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

const passageOutputs: Record<string, z.ZodType<Passage[]>> = {
	searchKnowledgeBase: searchOutputSchema.transform(({ results }) => results),
	getKnowledgeBaseChunks: chunksOutputSchema.transform(
		({ passages }) => passages,
	),
	getKnowledgeBasePage: pageOutputSchema.transform(({ passages }) => passages),
};

/** The passages a knowledge base call returned; none for other tools and older shapes. */
export const passagesOf = (toolName: string, output: unknown): Passage[] =>
	(Object.hasOwn(passageOutputs, toolName)
		? passageOutputs[toolName].safeParse(output).data
		: undefined) ?? [];

/** The passages of a message's finished knowledge base calls. */
export const passagesOfParts = (
	parts: readonly {
		type: string;
	}[],
) =>
	parts.flatMap((part) =>
		part.type.startsWith("tool-") &&
		"state" in part &&
		part.state === "output-available" &&
		"output" in part
			? passagesOf(part.type.slice("tool-".length), part.output)
			: [],
	);

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
			`[${passage.ref}] ${passage.title}`,
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

const documentState = ({
	state,
	failure,
}: Pick<KnowledgeBaseDocument, "state" | "failure">) => {
	if (state === "ready") return "";
	if (failure) return ` [failed in ${failure.stage}: ${failure.kind}]`;
	return ` [${state}, not searchable yet]`;
};

const documentsText = (documents: KnowledgeBaseDocument[]) =>
	documents.length > 0
		? documents
				.map(
					(document) =>
						`- ${document.assetId}: ${document.title}${document.citation ? ` (${document.citation})` : ""}${documentState(document)}${document.description ? `\n  ${document.description.replace(/\s+/g, " ").trim()}` : ""}`,
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

export const searchModelOutput = modelText(
	searchOutputSchema,
	({ results, notSearchable }) =>
		[
			passagesText(results),
			...(notSearchable && notSearchable.length > 0
				? [
						`Not searchable yet:\n${notSearchable.map(({ note }) => `- ${note}`).join("\n")}`,
					]
				: []),
		].join("\n\n"),
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
