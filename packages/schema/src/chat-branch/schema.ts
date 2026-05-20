import type { ChatBranchId } from "@orcai/core";
import { z } from "zod/v4";
import { chatIdSchema } from "../chat/schema";
import { chatMessageIdSchema } from "../chat-message";
import { createUuidIdSchema } from "../shared";

export const chatBranchIdSchema = createUuidIdSchema<ChatBranchId>();

export const chatBranchSchema = z.object({
	id: chatBranchIdSchema,
	chatId: chatIdSchema,
	leafMessageId: chatMessageIdSchema.nullable(),
	name: z.string(),
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export type ChatBranch = z.infer<typeof chatBranchSchema>;
