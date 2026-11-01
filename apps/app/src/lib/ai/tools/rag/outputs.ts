import type { ToolResultPart } from "ai";
import { z } from "zod/v4";
import type { Source } from "@/lib/ai/citations/source-ref";
import { dataTag } from "@/lib/ai/utils/data-tag";
import {
	type Passage,
	passageSchema,
	type RepositoryAsset,
	repositoryAssetSchema,
} from "./types";

/** What the repository tools store; a stored output of an older shape fails to parse. */
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

export const passagesOutputSchema = z.object({
	passages: z.array(passageSchema),
	missing: z.array(z.string()).optional(),
});

export const pageOutputSchema = z.object({
	passages: z.array(passageSchema),
	matchedAssets: z.array(repositoryAssetSchema).optional(),
});

export const listOutputSchema = z.object({
	assets: z.array(repositoryAssetSchema),
});

/** A passage's source; a passage on one page names the page. */
export const passageSources = (passages: Passage[]): Source[] =>
	passages.map(({ ref, id, assetId, title, pageStart, pageEnd }) => ({
		ref,
		identity: id,
		citation: {
			kind: "asset",
			assetId,
			title,
			...(pageStart !== undefined &&
				pageStart === pageEnd && {
					page: pageStart,
				}),
		},
	}));

const pagesOf = ({ pageStart, pageEnd }: Passage) => {
	if (pageStart === undefined) {
		return undefined;
	}

	return pageEnd === undefined || pageEnd === pageStart
		? `${pageStart}`
		: `${pageStart}-${pageEnd}`;
};

const passageText = (passage: Passage) =>
	dataTag(
		"passage",
		{
			ref: passage.ref,
			asset: passage.title,
			pages: pagesOf(passage),
		},
		passage.text,
	);

const passagesText = (passages: Passage[]) =>
	passages.length > 0
		? passages.map(passageText).join("\n\n")
		: "No matching passages.";

const assetState = ({
	state,
	failure,
}: Pick<RepositoryAsset, "state" | "failure">) => {
	if (state === "ready") return "";
	if (failure) return ` [failed in ${failure.stage}: ${failure.kind}]`;
	return ` [${state}, not searchable yet]`;
};

const assetsText = (assets: RepositoryAsset[]) =>
	assets.length > 0
		? assets
				.map(
					(asset) =>
						`- ${asset.assetId}: ${asset.title}${asset.citation ? ` (${asset.citation})` : ""}${assetState(asset)}${asset.description ? `\n  ${asset.description.replace(/\s+/g, " ").trim()}` : ""}`,
				)
				.join("\n")
		: "No assets.";

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

export const passagesModelOutput = modelText(
	passagesOutputSchema,
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
	({ passages, matchedAssets }) =>
		[
			passagesText(passages),
			...(matchedAssets && matchedAssets.length > 0
				? [
						`Matching assets:\n${assetsText(matchedAssets)}`,
					]
				: []),
		].join("\n\n"),
);

export const listModelOutput = modelText(listOutputSchema, ({ assets }) =>
	assetsText(assets),
);
