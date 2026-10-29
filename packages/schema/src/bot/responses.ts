import { z } from "zod/v4";
import {
	resourceOwnerSchema,
	sourceOrganizationSchema,
} from "../resource/schema";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { botIdSchema } from "./ref";
import {
	botEditorSchema,
	botListItemSchema,
	botWithBlocksSchema,
} from "./schema";

export const listBotsResponseSchema =
	createListResponseSchema(botListItemSchema);

export const findBotResponseSchema = createDataResponseSchema(
	botWithBlocksSchema.extend({
		owner: resourceOwnerSchema,
		/** Set when the active organisation added the bot from the catalogue. */
		installedFrom: sourceOrganizationSchema.nullable(),
	}),
);

export const findBotEditorResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const saveBotResponseSchema = createDataResponseSchema(botEditorSchema);

export const publishBotResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const setBotFavouriteResponseSchema = createDataResponseSchema(
	z.object({
		id: botIdSchema,
		favourite: z.boolean(),
	}),
);

export const deleteBotsResponseSchema = createDeleteResponseSchema();
