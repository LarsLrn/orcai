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
	/** What the reply's last step took and wrote, so what its context held. */
	contextTokens: z.number().optional(),
	/** The context window of the reply's model, when known. */
	contextWindow: z.number().optional(),
	siblingCount: z.number().optional(),
	siblingIndex: z.number().optional(),
	siblingIds: z.array(z.string()).optional(),
	attachments: z.array(chatMessageAttachmentSchema).optional(),
	/** The newest zedToken of the turn that wrote the reply, for its continuation. */
	zedToken: z.string().optional(),
	/** When a running continuation claimed the reply (ISO string). */
	continuedAt: z.string().optional(),
	/** The turn used up its steps on a step that still called tools. */
	stepLimitReached: z.boolean().optional(),
});

export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>;
