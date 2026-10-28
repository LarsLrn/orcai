import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { modelIdSchema } from "../model/ref";
import { zedTokenSchema } from "../shared";
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

export type FindBotSetupInput = z.infer<typeof findBotSetupInputSchema>;
export type SaveBotSetupInput = z.infer<typeof saveBotSetupInputSchema>;
export type BotSetupCoverageInput = z.infer<typeof botSetupCoverageInputSchema>;
