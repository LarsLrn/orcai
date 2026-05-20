import { assetIdSchema, bucketSchema } from "@orcai/schema";
import { z } from "zod/v4";

export const chatAttachmentSourceSchema = z.enum([
	"upload",
	"library",
]);

export const chatAttachmentSchema = z.object({
	assetId: assetIdSchema,
	title: z.string().min(1),
	fileType: z.string().min(1),
	size: z.number().int().nonnegative(),
	bucket: bucketSchema,
	prefix: z.string().min(1),
	source: chatAttachmentSourceSchema,
});

export const chatAttachmentsSchema = z.array(chatAttachmentSchema);

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

const parseAttachmentsSafe = (value: unknown) => {
	const parsed = chatAttachmentsSchema.safeParse(value);
	return parsed.success ? parsed.data : [];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const getChatMessageAttachments = (message: {
	attachments?: unknown;
	metadata?: unknown;
}): ChatAttachment[] => {
	const directAttachments = parseAttachmentsSafe(message.attachments);
	if (directAttachments.length > 0) {
		return directAttachments;
	}

	if (!isRecord(message.metadata)) {
		return [];
	}

	return parseAttachmentsSafe(message.metadata.attachments);
};
