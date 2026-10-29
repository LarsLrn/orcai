import { z } from "zod/v4";
import { assetListItemSchema } from "../asset/schema";
import { blockListItemSchema } from "../block/responses";
import { botListItemSchema } from "../bot/schema";
import { createDataResponseSchema, createListResponseSchema } from "../shared";
import { libraryKindSchema } from "../shared/library";

/** One tile of a mixed library list. */
export const libraryEntrySchema = z.discriminatedUnion("kind", [
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

/** How many items each kind holds. Assets count those uploaded to the library. */
export const libraryCountsSchema = z.record(libraryKindSchema, z.number());

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
export type LibraryOverview = z.infer<
	typeof libraryOverviewResponseSchema
>["data"];
