import { generateText } from "ai";
import * as Effect from "effect/Effect";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { AiError } from "@/lib/effect/utils/errors";
import { getSaiaModel } from "./saia-models";

export const generateChatTitle = (params: { messages: ChatAgentUIMessage[] }) =>
	Effect.gen(function* () {
		const { messages } = params;

		// Extract only user and assistant messages for context
		const conversationContext = messages
			.filter((msg) => msg.role === "user" || msg.role === "assistant")
			.slice(0, 6) // Use first 6 messages for title generation
			.map((msg) => {
				// Extract text from message parts
				const textContent = msg.parts
					.filter((part) => part.type === "text")
					.map((part) => ("text" in part ? part.text : ""))
					.join(" ");
				return `${msg.role}: ${textContent}`;
			})
			.join("\n");

		return yield* Effect.tryPromise({
			try: () =>
				generateText({
					model: getSaiaModel({
						input: ["text"],
						model: "meta-llama-3.1-8b-instruct",
					}).provider,
					prompt: `Based on the following conversation, generate a short, descriptive title (maximum 80 characters). The title should capture the main topic or purpose of the conversation. Return ONLY the title text, nothing else
      
      			Conversation:
      			${conversationContext}`,
				}),
			catch: (cause) => new AiError({ operation: "generateChatTitle", cause }),
		}).pipe(Effect.map((response) => ({ title: response.text })));
	});
