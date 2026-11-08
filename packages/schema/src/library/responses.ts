import { z } from "zod/v4";
import { assetListItemSchema } from "../asset/schema";
import { blockListItemSchema } from "../block/responses";
import { botListItemSchema } from "../bot/schema";
import { libraryKindSchema } from "../shared/library";
import {
	createDataResponseSchema,
	createListResponseSchema,
} from "../shared/responses";

/** One tile of a mixed library list. */
const libraryEntrySchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("bot"),
		bot: botListItemSchema,
	}),
	z.object({
		kind: z.literal("block"),
		block: blockListItemSchema,
	}),
	z.object({
		kind: z.literal("asset"),
		asset: assetListItemSchema,
	}),
]);

/**
 * How many items each kind holds, drafts included, and how many of them are
 * drafts. Assets count those uploaded to the library and have no drafts.
 */
const libraryCountsSchema = z.record(
	libraryKindSchema,
	z.object({
		total: z.number(),
		drafts: z.number(),
	}),
);

const shelfSchema = <TItemSchema extends z.ZodType>(itemSchema: TItemSchema) =>
	z.object({
		data: z.array(itemSchema),
		rowCount: z.number(),
	});

export const libraryCountsResponseSchema =
	createDataResponseSchema(libraryCountsSchema);

export const libraryOverviewResponseSchema = createDataResponseSchema(
	z.object({
		favourites: z.array(botListItemSchema),
		/** Drafts across kinds, newest first; only with scope "edit". */
		drafts: z.array(libraryEntrySchema),
		bot: shelfSchema(botListItemSchema),
		behaviour: shelfSchema(blockListItemSchema),
		repository: shelfSchema(blockListItemSchema),
		asset: shelfSchema(assetListItemSchema),
	}),
);

export const searchLibraryResponseSchema =
	createListResponseSchema(libraryEntrySchema);

export type LibraryEntry = z.infer<typeof libraryEntrySchema>;
export type LibraryCounts = z.infer<typeof libraryCountsSchema>;
