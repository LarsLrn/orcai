import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	zedTokenSchema,
} from "../shared";
import { botEditorSchema, botSchema, botWithBlocksSchema } from "./schema";

export const listBotsResponseSchema = createListResponseSchema(botSchema);

export const findBotResponseSchema =
	createDataResponseSchema(botWithBlocksSchema);

export const findBotEditorResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const saveBotResponseSchema = createDataResponseSchema(
	botEditorSchema,
).extend({
	meta: zedTokenSchema.optional(),
});

export const publishBotResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const listDraftBotsResponseSchema = createListResponseSchema(botSchema);

export const deleteBotsResponseSchema = createDeleteResponseSchema();
