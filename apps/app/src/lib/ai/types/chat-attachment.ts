import {
	type ChatMessageAttachment,
	chatMessageAttachmentSchema,
} from "@orcai/schema";
import { z } from "zod/v4";

const parseAttachmentsSafe = (value: unknown) => {
	const parsed = z.array(chatMessageAttachmentSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const getChatMessageAttachments = (message: {
	attachments?: unknown;
	metadata?: unknown;
}): ChatMessageAttachment[] => {
	const directAttachments = parseAttachmentsSafe(message.attachments);
	if (directAttachments.length > 0) {
		return directAttachments;
	}

	if (!isRecord(message.metadata)) {
		return [];
	}

	return parseAttachmentsSafe(message.metadata.attachments);
};
