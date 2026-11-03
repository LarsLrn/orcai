import { z } from "zod/v4";
import { botIdSchema, modelIdSchema } from "../shared/ids";
import { zedTokenSchema } from "../shared/zed-token";
import { botSetupFieldsSchema } from "./schema";

export const findBotSetupInputSchema = z.object({
	botId: botIdSchema,
	...zedTokenSchema.shape,
});

/** Null removes the setup, so the bot's chats pick their model freely. */
export const saveBotSetupInputSchema = z.object({
	botId: botIdSchema,
	setup: botSetupFieldsSchema.nullable(),
	...zedTokenSchema.shape,
});

export const botSetupCoverageInputSchema = z.object({
	botId: botIdSchema,
	modelId: modelIdSchema,
	...zedTokenSchema.shape,
});
