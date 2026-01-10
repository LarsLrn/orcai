import { generateText } from "ai";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getSaiaModel } from "./saia-models";

export const generateChatTitle = async (params: {
	messages: ChatAgentUIMessage[];
}): Promise<{ title: string }> => {
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

	const response = await generateText({
		model: getSaiaModel({
			input: ["text"],
			model: "meta-llama-3.1-8b-instruct",
		}).provider,
		prompt: `Based on the following conversation, generate a short, descriptive title (maximum 80 characters). The title should capture the main topic or purpose of the conversation. Return\nONLY the title text, nothing else
      
      Conversation:
      ${conversationContext}`,
	});

	return {
		title: response.text,
	};
};
