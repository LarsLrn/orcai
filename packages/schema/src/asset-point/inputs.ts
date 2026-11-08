import { z } from "zod/v4";
import { assetIdSchema, blockIdSchema } from "../shared/ids";
import {
	assetPointBrowseCursorSchema,
	assetPointsFiltersSchema,
	SEARCH_QUERIES_MAX,
} from "./schema";

export const searchRepositoryAssetPointsInputSchema = z.object({
	repositoryId: blockIdSchema,
	filters: assetPointsFiltersSchema.omit({
		blockId: true,
	}),
});

/**
 * Several repository searches answered together, one per repository, their
 * queries embedded once: at most `SEARCH_QUERIES_MAX` distinct wordings in
 * all, as one search takes.
 */
export const searchRepositoriesAssetPointsInputSchema = z.object({
	searches: z
		.array(searchRepositoryAssetPointsInputSchema)
		.min(1)
		.refine(
			(searches) =>
				new Set(searches.map(({ repositoryId }) => repositoryId)).size ===
				searches.length,
			"Each repository can be searched once per request.",
		)
		.refine(
			(searches) =>
				new Set(searches.flatMap(({ filters }) => filters.queries ?? []))
					.size <= SEARCH_QUERIES_MAX,
			`The searches can share at most ${SEARCH_QUERIES_MAX} distinct wordings.`,
		),
});

/**
 * A page of a repository's passages in point order, or of one of its assets
 * with `assetId` in reading order; a cursor continues only the order it came from.
 */
export const browseRepositoryAssetPointsInputSchema = z
	.object({
		repositoryId: blockIdSchema,
		assetId: assetIdSchema.optional(),
		cursor: assetPointBrowseCursorSchema.optional(),
	})
	.refine(
		(input) =>
			!input.cursor ||
			(input.cursor.order === "reading") === (input.assetId !== undefined),
		{
			message: "The cursor belongs to another browse order",
			path: [
				"cursor",
			],
		},
	);
