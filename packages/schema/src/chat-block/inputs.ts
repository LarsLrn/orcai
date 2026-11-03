import { z } from "zod/v4";
import { blockIdSchema, chatIdSchema } from "../shared/ids";
import { zedTokenSchema } from "../shared/zed-token";

export const listChatBlocksInputSchema = z.object({
	chatId: chatIdSchema,
	...zedTokenSchema.shape,
});

export const attachChatBlockInputSchema = z.object({
	chatId: chatIdSchema,
	blockId: blockIdSchema,
	...zedTokenSchema.shape,
});

export const detachChatBlockInputSchema = z.object({
	chatId: chatIdSchema,
	blockId: blockIdSchema,
	...zedTokenSchema.shape,
});

export type ListChatBlocksInput = z.infer<typeof listChatBlocksInputSchema>;
export type AttachChatBlockInput = z.infer<typeof attachChatBlockInputSchema>;
export type DetachChatBlockInput = z.infer<typeof detachChatBlockInputSchema>;
