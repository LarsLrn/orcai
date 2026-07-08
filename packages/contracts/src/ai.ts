import { aiChatInputSchema, aiChatResponseSchema } from "@orcai/schema";
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
};
