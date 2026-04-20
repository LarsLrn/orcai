import type { ChatBranchId, ChatId } from "@orcai/core";
import { type } from "@orpc/server";
import { base } from "./base";

export const aiChatContract = base
	.route({
		method: "POST",
		path: "/ai",
		summary: "Chat with AI",
		tags: [
			"AI",
		],
	})
	// TODO: Check if this is doable with Zod
	.input(
		type<{
			chatId: ChatId;
			// Typing this properly as ChatAgentUIMessage[] would create a circular type dependency
			// TODO: Check for a solution to fix circular type dependency
			messages: any;
			branchId?: ChatBranchId;
			zedToken?: string;
		}>(),
	)
	// TODO: Improve return type
	.output(type<any>());
