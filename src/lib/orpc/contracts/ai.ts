import { type } from "@orpc/server";
import type { UIDataTypes, UIMessageChunk } from "ai";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { base } from "./base";

export const aiChatContract = base
	.route({
		method: "POST",
		path: "/ai",
		summary: "Chat with AI",
		tags: ["AI"],
	})
	// TODO: Check if this is doable with Zod
	.input(type<{ chatId: string; messages: CustomUIMessage[] }>())
	.output(type<any>());
