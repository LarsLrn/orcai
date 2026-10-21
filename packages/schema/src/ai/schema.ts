import { z } from "zod/v4";
import {
	CHAT_MESSAGE_ATTACHMENT_LIMIT,
	chatAttachmentRefSchema,
} from "../chat-message/parts/attachment";
import { chatMessageIdSchema } from "../chat-message/ref";

/** What a user message says; attachments travel beside it. */
const aiChatTextPartSchema = z.object({
	type: z.literal("text"),
	text: z.string(),
});

export const aiChatMessageSchema = z.object({
	id: chatMessageIdSchema,
	role: z.literal("user"),
	parts: z.array(aiChatTextPartSchema),
	attachments: z
		.array(chatAttachmentRefSchema)
		.max(CHAT_MESSAGE_ATTACHMENT_LIMIT)
		.default([]),
});

export const aiChatStreamSchema = z.custom<AsyncIterator<any>>(
	(value) =>
		value !== null &&
		typeof value === "object" &&
		typeof (
			value as {
				next?: unknown;
			}
		).next === "function",
);

export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;
export type AiChatStream = z.infer<typeof aiChatStreamSchema>;
