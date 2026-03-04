import { type } from "@orpc/server";
import type { Bot } from "@/lib/orpc/schemas/bot";
import type { Chat } from "@/lib/orpc/schemas/chat";
import type { ChatBranch } from "@/lib/orpc/schemas/chat-branch";
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
			chatId: Chat["id"];
			// Typing this properly as ChatAgentUIMessage[] would create a circular type dependency
			// TODO: Check for a solution to fix circular type dependency
			messages: any;
			botId?: Bot["id"] | null | undefined;
			branchId?: ChatBranch["id"];
		}>(),
	)
	// TODO: Improve return type
	.output(type<any>());
