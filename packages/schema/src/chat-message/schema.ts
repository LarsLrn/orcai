import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { chatMessageAttachmentSchema } from "./parts/attachment";
import { chatMessageMetadataSchema } from "./parts/metadata";
import { chatMessageIdSchema } from "./ref";

export const chatMessagePartsSchema = z.array(z.unknown());

const chatMessageFieldsSchema = z.object({
	chatId: chatIdSchema,
	role: z.string(),
	parts: chatMessagePartsSchema,
	attachments: z.array(chatMessageAttachmentSchema),
	metadata: chatMessageMetadataSchema,
});

export const chatMessageSchema = chatMessageFieldsSchema.extend({
	id: chatMessageIdSchema,
	position: z.number().int().nonnegative(),
	createdAt: z.coerce.date(),
});

export const chatMessageRatingSchema = z.enum([
	"very_much",
	"a_bit",
	"not_really",
	"not_at_all",
]);

export type ChatMessageRating = z.infer<typeof chatMessageRatingSchema>;
export type ChatMessageParts = z.infer<typeof chatMessagePartsSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
