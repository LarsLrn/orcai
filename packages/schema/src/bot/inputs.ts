import { z } from "zod/v4";
import { blockIdSchema } from "../block/ref";
import { featuresSchema } from "../feature/schema";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import {
	libraryOriginSchema,
	libraryScopeSchema,
	publicationStatusFilterSchema,
} from "../shared/library";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { botIdSchema } from "./ref";
import { botContentJsonSchema, botFieldsSchema } from "./schema";

export const botListSortSchema = z.enum([
	"name",
	"favouritesFirst",
	"newest",
]);

export const listBotsInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	search: z.string().optional(),
	filters: z
		.object({
			favourite: z.boolean().optional(),
			/** Published bots unless given. */
			status: publicationStatusFilterSchema.optional(),
			scope: libraryScopeSchema.optional(),
			origin: libraryOriginSchema.optional(),
			/** Only bots the user may start a chat with in the active organisation. */
			usable: z.boolean().optional(),
		})
		.optional(),
	sort: botListSortSchema.default("name"),
});

export const findBotInputSchema = z.object({
	id: botIdSchema,
	...zedTokenSchema.shape,
});

export const findBotEditorInputSchema = z.object({
	id: botIdSchema,
	...zedTokenSchema.shape,
});

export const saveBotInputSchema = z.object({
	...zedTokenSchema.shape,
	id: botIdSchema.optional(),
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description,
	contentJson: botContentJsonSchema.default({}),
	status: publicationStatusSchema,
	behaviourId: blockIdSchema.nullable().default(null),
	repositoryIds: z.array(blockIdSchema).default([]),
	features: featuresSchema.default({}),
	/** Unlisted blocks a listed bot gains, confirmed to be listed with it. */
	listBlockIds: z.array(blockIdSchema).default([]),
});

export const publishBotInputSchema = z.object({
	id: botIdSchema,
});

export const setBotFavouriteInputSchema = z.object({
	id: botIdSchema,
	favourite: z.boolean(),
});

export const deleteBotsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: botIdSchema,
	}),
});

export type BotListSort = z.infer<typeof botListSortSchema>;
export type ListBotsInput = z.infer<typeof listBotsInputSchema>;
export type FindBotInput = z.infer<typeof findBotInputSchema>;
export type FindBotEditorInput = z.infer<typeof findBotEditorInputSchema>;
export type SaveBotInput = z.infer<typeof saveBotInputSchema>;
export type PublishBotInput = z.infer<typeof publishBotInputSchema>;
export type SetBotFavouriteInput = z.infer<typeof setBotFavouriteInputSchema>;
export type DeleteBotsInput = z.infer<typeof deleteBotsInputSchema>;
