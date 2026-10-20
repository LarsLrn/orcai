import {
	aiChatInputSchema,
	aiChatResponseSchema,
	continueChatInputSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const aiContracts = {
	chat: base
		.meta(
			openapi({
				method: "POST",
				path: "/ai",
				summary: "Chat with AI",
				tags: [
					"AI",
				],
			}),
		)
		.input(aiChatInputSchema)
		.output(aiChatResponseSchema),
	continue: base
		.meta(
			openapi({
				method: "POST",
				path: "/ai/continue",
				summary: "Continue an AI turn after tool approvals",
				tags: [
					"AI",
				],
			}),
		)
		.input(continueChatInputSchema)
		.output(aiChatResponseSchema),
};
