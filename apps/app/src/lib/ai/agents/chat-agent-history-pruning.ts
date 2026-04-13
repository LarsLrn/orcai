import { type ModelMessage, pruneMessages } from "ai";

const ASSISTANT_TOOL_PART_TYPES = new Set([
	"tool-call",
	"tool-result",
	"tool-approval-request",
]);

const isToolBearingAssistantMessage = (message: ModelMessage): boolean =>
	message.role === "assistant" &&
	Array.isArray(message.content) &&
	message.content.some((part) => ASSISTANT_TOOL_PART_TYPES.has(part.type));

export const pruneToolHistory = (messages: ModelMessage[]): ModelMessage[] => {
	let latestToolAssistantIndex = -1;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (isToolBearingAssistantMessage(messages[index])) {
			latestToolAssistantIndex = index;
			break;
		}
	}

	if (latestToolAssistantIndex === -1) {
		return messages;
	}

	const keptMessageCount = messages.length - latestToolAssistantIndex;
	const toolCalls =
		keptMessageCount === 1
			? "before-last-message"
			: (`before-last-${keptMessageCount}-messages` as const);

	return pruneMessages({
		messages,
		toolCalls,
		emptyMessages: "remove",
	});
};

export const applyToolHistoryPruning = <
	T extends {
		messages?: ModelMessage[];
		prompt?: string | ModelMessage[];
	},
>(
	settings: T,
): T => {
	if (settings.messages) {
		return {
			...settings,
			messages: pruneToolHistory(settings.messages),
		};
	}

	if (Array.isArray(settings.prompt)) {
		return {
			...settings,
			prompt: pruneToolHistory(settings.prompt),
		};
	}

	return settings;
};
