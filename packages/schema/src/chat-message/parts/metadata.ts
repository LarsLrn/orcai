import { z } from "zod/v4";
import { chatMessageAttachmentSchema } from "./attachment";

export const chatMessageMetadataSchema = z.object({
	model: z.string().optional(),
	totalUsage: z
		.object({
			inputTokens: z.number().optional(),
			inputTokenDetails: z
				.object({
					noCacheTokens: z.number().optional(),
					cacheReadTokens: z.number().optional(),
					cacheWriteTokens: z.number().optional(),
				})
				.optional(),
			outputTokens: z.number().optional(),
			outputTokenDetails: z
				.object({
					textTokens: z.number().optional(),
					reasoningTokens: z.number().optional(),
				})
				.optional(),
			totalTokens: z.number().optional(),
		})
		.optional(),
	siblingCount: z.number().optional(),
	siblingIndex: z.number().optional(),
	siblingIds: z.array(z.string()).optional(),
	attachments: z.array(chatMessageAttachmentSchema).optional(),
});

export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>;
