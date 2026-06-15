import { aiChatInputSchema, aiChatResponseSchema } from "@orcai/schema";
import { base } from "./base";

export const aiContracts = {
	chat: base
		.route({
			method: "POST",
			path: "/ai",
			summary: "Chat with AI",
			tags: [
				"AI",
			],
		})
		.input(aiChatInputSchema)
		.output(aiChatResponseSchema),
};
