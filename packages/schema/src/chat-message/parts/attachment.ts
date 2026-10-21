import { z } from "zod/v4";
import { assetIdSchema } from "../../asset/ref";

export const CHAT_MESSAGE_ATTACHMENT_LIMIT = 8;

/** An asset a user message attaches; the server reads the rest from the asset. */
export const chatAttachmentRefSchema = z.object({
	assetId: assetIdSchema,
});

/** What a message shows of an attached asset; storage comes from the asset when read. */
export const chatMessageAttachmentSchema = chatAttachmentRefSchema.extend({
	title: z.string().min(1),
	fileType: z.string().min(1),
	size: z.number().int().nonnegative(),
});

export type ChatAttachmentRef = z.infer<typeof chatAttachmentRefSchema>;
export type ChatMessageAttachment = z.infer<typeof chatMessageAttachmentSchema>;
