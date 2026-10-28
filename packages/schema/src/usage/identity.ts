import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { userIdSchema } from "../user/ref";

/** A current member, or someone who has left the organisation, unnamed. */
export const usagePersonSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("member"),
		id: userIdSchema,
		name: z.string(),
		email: z.string(),
	}),
	z.object({
		kind: z.literal("former"),
	}),
]);

/**
 * A bot the viewer can read, usage outside bot chats or before bots were
 * recorded, or a bot the viewer cannot read, unnamed.
 */
export const usageBotSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("bot"),
		id: botIdSchema,
		name: z.string(),
	}),
	z.object({
		kind: z.literal("none"),
	}),
	z.object({
		kind: z.literal("other"),
	}),
]);

export type UsagePerson = z.infer<typeof usagePersonSchema>;
export type UsageBot = z.infer<typeof usageBotSchema>;
