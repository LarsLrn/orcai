import type { ChatMessageId } from "@orcai/core";
import { z } from "zod/v4";
import { chatIdSchema } from "../chat";
import { createUuidIdSchema } from "../shared";

export const chatMessageIdSchema = createUuidIdSchema<ChatMessageId>();

export const chatMessagePartsSchema = z.array(z.unknown());
export const chatMessageAttachmentsSchema = z.array(z.unknown());
export const chatMessageMetadataSchema = z.record(z.string(), z.unknown());

export const chatMessageFieldsSchema = z.object({
	chatId: chatIdSchema,
	role: z.string(),
	parts: chatMessagePartsSchema,
	attachments: chatMessageAttachmentsSchema,
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
export type ChatMessageAttachments = z.infer<
	typeof chatMessageAttachmentsSchema
>;
export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
