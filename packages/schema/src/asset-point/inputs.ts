import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import {
	assetPointBrowseCursorSchema,
	assetPointsFiltersSchema,
} from "./schema";

export const searchRepositoryAssetPointsInputSchema = z.object({
	repositoryId: blockIdSchema,
	filters: assetPointsFiltersSchema.omit({
		blockId: true,
	}),
});

/**
 * A page of a repository's passages in point order, or of one of its documents
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

export type SearchRepositoryAssetPointsInput = z.infer<
	typeof searchRepositoryAssetPointsInputSchema
>;
export type BrowseRepositoryAssetPointsInput = z.infer<
	typeof browseRepositoryAssetPointsInputSchema
>;
