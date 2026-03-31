import { dbSchema } from "@orcai/db/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zedTokenSchema } from "./shared";

export const chatBlockSelectSchema = createSelectSchema(dbSchema.chatBlock);

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
