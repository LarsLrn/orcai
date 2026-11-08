import { z } from "zod/v4";
import { chatIdSchema, chatMessageIdSchema } from "../shared/ids";
import { chatMessageAttachmentSchema } from "./parts/attachment";
import { readableChatMessageParts } from "./parts/message-part";
import { chatMessageMetadataSchema } from "./parts/metadata";

const chatMessageFieldsSchema = z.object({
	chatId: chatIdSchema,
	role: z.string(),
	parts: z.array(z.unknown()).transform(readableChatMessageParts),
	attachments: z.array(chatMessageAttachmentSchema),
	metadata: chatMessageMetadataSchema,
});

export const chatMessageSchema = chatMessageFieldsSchema.extend({
	id: chatMessageIdSchema,
	position: z.number().int().nonnegative(),
	createdAt: z.coerce.date(),
});

export const CHAT_MESSAGE_RATINGS = [
	"very_much",
	"a_bit",
	"not_really",
	"not_at_all",
] as const;

export const chatMessageRatingSchema = z.enum(CHAT_MESSAGE_RATINGS);

export type ChatMessageRating = z.infer<typeof chatMessageRatingSchema>;
