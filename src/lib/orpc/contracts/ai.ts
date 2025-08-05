import { type } from "@orpc/server";
import type { Chat } from "@/db/schema/chat";
import type { CustomUIMessage } from "@/lib/ai/tools";
import type { Bot } from "../schemas/bot";
import { base } from "./base";

export const aiChatContract = base
	.route({
		method: "POST",
		path: "/ai",
		summary: "Chat with AI",
		tags: ["AI"],
	})
	// TODO: Check if this is doable with Zod
	.input(
		type<{
			chatId: Chat["id"];
			messages: CustomUIMessage[];
			botId?: Bot["id"] | null | undefined;
		}>(),
	)
	// TODO: Improve return type
	.output(type<any>());
