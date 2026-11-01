import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { chatIdSchema } from "../chat/ref";
import { MAX_KEPT_UPLOADS } from "../chat-message/parts/metadata";
import { chatMessageIdSchema } from "../chat-message/ref";
import { zedTokenSchema } from "../shared";
import { aiChatMessageSchema } from "./schema";

/**
 * The browser's IANA time zone, which sets the user's local date in the
 * prompt. A value the server cannot use becomes none, so a send never fails on it.
 */
const timeZoneShape = {
	timeZone: z.string().max(100).optional().catch(undefined),
};

export const aiChatInputSchema = z.object({
	chatId: chatIdSchema,
	message: aiChatMessageSchema,
	...timeZoneShape,
	...zedTokenSchema.shape,
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;

export const toolApprovalDecisionSchema = z.object({
	approvalId: z.string().min(1).max(200),
	approved: z.boolean(),
	reason: z.string().max(1000).optional(),
});

export type ToolApprovalDecision = z.infer<typeof toolApprovalDecisionSchema>;

const toolCallIdSchema = z.string().min(1).max(200);

/** A client tool's result; the server validates `output` against that tool's schema. */
export const clientToolOutputSchema = z.strictObject({
	toolCallId: toolCallIdSchema,
	output: z.unknown(),
});

export type ClientToolOutput = z.infer<typeof clientToolOutputSchema>;

export const continueChatInputSchema = z.object({
	chatId: chatIdSchema,
	messageId: chatMessageIdSchema,
	approvals: z.array(toolApprovalDecisionSchema).max(20),
	toolOutputs: z.array(clientToolOutputSchema).max(20).default([]),
	...timeZoneShape,
	...zedTokenSchema.shape,
});

export type ContinueChatInput = z.infer<typeof continueChatInputSchema>;

/** The files a waiting `requestUpload` call lists so far, kept with its reply. */
export const keepUploadsInputSchema = z.object({
	chatId: chatIdSchema,
	messageId: chatMessageIdSchema,
	toolCallId: toolCallIdSchema,
	assetIds: z.array(assetIdSchema).max(MAX_KEPT_UPLOADS),
	/** What the newest upload returned, which also reads the assets. */
	...zedTokenSchema.shape,
});

export type KeepUploadsInput = z.infer<typeof keepUploadsInputSchema>;
