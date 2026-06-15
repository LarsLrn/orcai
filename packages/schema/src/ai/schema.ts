import { z } from "zod/v4";

export const aiChatMessageSchema = z
	.object({
		id: z.string(),
		role: z.enum([
			"system",
			"user",
			"assistant",
		]),
		parts: z.array(z.unknown()),
		metadata: z.unknown().optional(),
		attachments: z.unknown().optional(),
	})
	.catchall(z.unknown());

export const aiChatStreamSchema = z.custom<AsyncIterator<any>>(
	(value) =>
		value !== null &&
		typeof value === "object" &&
		typeof (
			value as {
				next?: unknown;
			}
		).next === "function",
);

export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;
export type AiChatStream = z.infer<typeof aiChatStreamSchema>;
