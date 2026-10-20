import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { chatMessageIdSchema } from "../chat-message/ref";
import { organizationIdSchema } from "../organization/ref";
import { searchFilterSchema } from "../shared/filters";
import { userIdSchema } from "../user/ref";
import { chatConfigSchema } from "./parts/config";
import { chatIdSchema } from "./ref";

export const chatKindSchema = z.enum([
	"chat",
	"assistant",
]);

export const chatFieldsSchema = z.object({
	title: z.string().nullable(),
	config: chatConfigSchema.nullable(),
	botId: botIdSchema.nullable(),
});

export const chatMutableFieldsSchema = chatFieldsSchema.partial();

export const chatSchema = chatFieldsSchema.extend({
	id: chatIdSchema,
	parentChatId: chatIdSchema.nullable(),
	branchedFromMessageId: chatMessageIdSchema.nullable(),
	kind: chatKindSchema,
	organizationId: organizationIdSchema.nullable(),
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

export const chatLinkSchema = z.object({
	id: chatIdSchema,
	title: z.string().nullable(),
});

export const chatBranchLinkSchema = chatLinkSchema.extend({
	branchedFromMessageId: chatMessageIdSchema,
	createdAt: z.coerce.date().nullable(),
});

export type ChatKind = z.infer<typeof chatKindSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type ChatLink = z.infer<typeof chatLinkSchema>;
export type ChatBranchLink = z.infer<typeof chatBranchLinkSchema>;
export type ChatListRow = z.infer<typeof chatListRowSchema>;
