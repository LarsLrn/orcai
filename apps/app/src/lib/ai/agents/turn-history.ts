import type { ModelMessage } from "ai";

/** The index of the turn in progress: every message after the last user message. */
export const currentTurnStart = (messages: readonly ModelMessage[]) =>
	messages.map((message) => message.role).lastIndexOf("user") + 1;

/**
 * Drops reasoning before `until`, by default every finished turn's. Signed
 * reasoning (Anthropic) is bound to the exact content before it, which
 * pruning and closed tool calls rewrite; the turn in progress stays intact.
 */
export const dropEarlierReasoning = (
	messages: ModelMessage[],
	until = currentTurnStart(messages),
): ModelMessage[] =>
	messages.flatMap((message, index) => {
		if (
			index >= until ||
			message.role !== "assistant" ||
			!Array.isArray(message.content) ||
			!message.content.some((part) => part.type === "reasoning")
		) {
			return [
				message,
			];
		}

		const content = message.content.filter((part) => part.type !== "reasoning");
		return content.length > 0
			? [
					{
						...message,
						content,
					},
				]
			: [];
	});
