import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import {
	botEditorSchema,
	botWithBlocksSchema,
	botWithCapabilitiesSchema,
} from "./schema";

export const listBotsResponseSchema = createListResponseSchema(
	botWithCapabilitiesSchema,
);

export const findBotResponseSchema =
	createDataResponseSchema(botWithBlocksSchema);

export const findBotEditorResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const saveBotResponseSchema = createDataResponseSchema(botEditorSchema);

export const publishBotResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const listDraftBotsResponseSchema = createListResponseSchema(
	botWithCapabilitiesSchema,
);

export const deleteBotsResponseSchema = createDeleteResponseSchema();
