import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { chatMessageAttachmentSchema } from "../zod/chat-message-attachment";
import { chatMessageMetadataSchema } from "../zod/chat-message-metadata";
import { chatMessageIdSchema } from "./ref";

export const chatMessagePartsSchema = z.array(z.unknown());

export const chatMessageFieldsSchema = z.object({
	chatId: chatIdSchema,
	role: z.string(),
	parts: chatMessagePartsSchema,
	attachments: z.array(chatMessageAttachmentSchema),
	metadata: chatMessageMetadataSchema,
	parentMessageId: chatMessageIdSchema.nullable().optional(),
	depth: z.number().int().default(0),
});

export const chatMessageMutableFieldsSchema = chatMessageFieldsSchema
	.omit({
		chatId: true,
		role: true,
		parentMessageId: true,
		depth: true,
	})
	.partial();

export const chatMessageSchema = chatMessageFieldsSchema.extend({
	id: chatMessageIdSchema,
	parentMessageId: chatMessageIdSchema.nullable(),
	createdAt: z.coerce.date(),
});

export type ChatMessageParts = z.infer<typeof chatMessagePartsSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
