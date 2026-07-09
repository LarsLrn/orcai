import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { chatBranchIdSchema } from "../chat-branch/ref";
import { searchFilterSchema } from "../shared/filters";
import { userIdSchema } from "../user/ref";
import { chatConfigSchema } from "./parts/config";
import { chatIdSchema } from "./ref";

export const chatFieldsSchema = z.object({
	title: z.string().nullable(),
	config: chatConfigSchema.nullable(),
	botId: botIdSchema.nullable(),
	activeBranchId: chatBranchIdSchema.nullable(),
});

export const chatMutableFieldsSchema = chatFieldsSchema.partial();

export const chatSchema = chatFieldsSchema.extend({
	id: chatIdSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const chatFiltersSchema = z.object({
	botId: botIdSchema.optional(),
	...searchFilterSchema.shape,
});

export const chatListRowSchema = chatSchema.extend({
	botName: z.string().nullable(),
});

export type Chat = z.infer<typeof chatSchema>;
export type ChatListRow = z.infer<typeof chatListRowSchema>;
