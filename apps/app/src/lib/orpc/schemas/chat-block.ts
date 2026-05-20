import { dbSchema } from "@orcai/db/schema";
import { blockIdSchema, chatIdSchema, zedTokenSchema } from "@orcai/schema";
import { createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod/v4";

export const chatBlockSelectSchema = createSelectSchema(dbSchema.chatBlock, {
	chatId: chatIdSchema,
	blockId: blockIdSchema,
});

export const chatBlockInsertSchema = z.object({
	chatId: chatBlockSelectSchema.shape.chatId,
	blockId: chatBlockSelectSchema.shape.blockId,
	...zedTokenSchema.shape,
});

export const chatBlockDeleteSchema = z.object({
	chatId: chatBlockSelectSchema.shape.chatId,
	blockId: chatBlockSelectSchema.shape.blockId,
	...zedTokenSchema.shape,
});

export const chatBlockListSchema = z.object({
	chatId: chatBlockSelectSchema.shape.chatId,
	...zedTokenSchema.shape,
});

export type ChatBlock = z.infer<typeof chatBlockSelectSchema>;
