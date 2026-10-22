import { type ModelMessage, pruneMessages } from "ai";
import {
	currentTurnStart,
	dropEarlierReasoning,
} from "@/lib/ai/agents/turn-history";

export interface ToolHistoryPruningOptions {
	/** Every content tool name, enabled or not. */
	contentToolNames: readonly string[];
	/** Content tools offered this turn; their calls stay in history. */
	enabledContentToolNames: readonly string[];
}

type ToolCallsRule = Extract<
	Parameters<typeof pruneMessages>[0]["toolCalls"],
	unknown[]
>[number];

const toolPartsOf = (message: ModelMessage) =>
	(message.role === "assistant" || message.role === "tool") &&
	Array.isArray(message.content)
		? message.content
		: [];

export const pruneToolHistory = (
	messages: ModelMessage[],
	{ contentToolNames, enabledContentToolNames }: ToolHistoryPruningOptions,
): ModelMessage[] => {
	const content = new Set(contentToolNames);
	const toolNameById = new Map<string, string>();
	for (const message of messages) {
		for (const part of toolPartsOf(message)) {
			if (part.type === "tool-call" || part.type === "tool-result") {
				toolNameById.set(part.toolCallId, part.toolName);
			}
		}
	}

	const otherToolNames = [
		...new Set(toolNameById.values()),
	].filter((name) => !content.has(name));

	const isOtherToolBearingAssistantMessage = (message: ModelMessage) =>
		message.role === "assistant" &&
		toolPartsOf(message).some((part) => {
			if (part.type === "tool-call" || part.type === "tool-result") {
				return !content.has(part.toolName);
			}
			if (part.type === "tool-approval-request") {
				const name = toolNameById.get(part.toolCallId);
				return name === undefined || !content.has(name);
			}
			return false;
		});

	const toolCalls: ToolCallsRule[] = [];

	const disabledContentToolNames = contentToolNames.filter(
		(name) => !enabledContentToolNames.includes(name),
	);
	if (disabledContentToolNames.length > 0) {
		toolCalls.push({
			type: "all",
			tools: disabledContentToolNames,
		});
	}

	let latestToolAssistantIndex = -1;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (isOtherToolBearingAssistantMessage(messages[index])) {
			latestToolAssistantIndex = index;
			break;
		}
	}
	if (latestToolAssistantIndex !== -1 && otherToolNames.length > 0) {
		const keptMessageCount = messages.length - latestToolAssistantIndex;
		toolCalls.push({
			type:
				keptMessageCount === 1
					? "before-last-message"
					: `before-last-${keptMessageCount}-messages`,
			tools: otherToolNames,
		});
	}

	if (toolCalls.length === 0) {
		return messages;
	}

	return pruneMessages({
		messages,
		toolCalls,
		emptyMessages: "remove",
	});
};

/**
 * Prunes the finished turns and drops their reasoning; the turn in progress
 * stays as sent, so every step of a turn gets the same result.
 */
export const pruneChatHistory = (
	messages: ModelMessage[],
	options: ToolHistoryPruningOptions,
): ModelMessage[] => {
	const turnStart = currentTurnStart(messages);
	return dropEarlierReasoning([
		...pruneToolHistory(messages.slice(0, turnStart), options),
		...messages.slice(turnStart),
	]);
};
