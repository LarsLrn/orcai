import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { chatMessageIdSchema } from "../chat-message/ref";
import { chatBranchIdSchema } from "./ref";

export const chatBranchSchema = z.object({
	id: chatBranchIdSchema,
	chatId: chatIdSchema,
	leafMessageId: chatMessageIdSchema.nullable(),
	name: z.string(),
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const chatBranchFieldsSchema = chatBranchSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const chatBranchMutableFieldsSchema = chatBranchFieldsSchema.partial();

export const chatBranchCreateInputSchema = z.object({
	chatId: chatIdSchema,
	leafMessageId: chatMessageIdSchema.nullable(),
	name: z.string(),
});

export const chatBranchUpdateInputSchema = chatBranchMutableFieldsSchema.extend(
	{
		id: chatBranchIdSchema,
	},
);

export const chatBranchDeleteInputSchema = z.object({
	id: chatBranchIdSchema,
});

export type ChatBranch = z.infer<typeof chatBranchSchema>;
export type CreateChatBranchInput = z.infer<typeof chatBranchCreateInputSchema>;
export type UpdateChatBranchInput = z.infer<typeof chatBranchUpdateInputSchema>;
export type DeleteChatBranchInput = z.infer<typeof chatBranchDeleteInputSchema>;
