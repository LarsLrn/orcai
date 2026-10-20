import { type ModelMessage, pruneMessages } from "ai";
import {
	currentTurnStart,
	dropEarlierReasoning,
} from "@/lib/ai/agents/turn-history";

export interface AssistantHistoryPruningOptions {
	/** Summary line per tool call id. */
	lines: ReadonlyMap<string, string>;
	/** Every display tool name, enabled or not. */
	displayToolNames: readonly string[];
	/** Display tools offered this turn; their calls stay in history in full. */
	enabledDisplayToolNames: readonly string[];
}

const TOOL_SET_CHANGING_TOOLS = new Set([
	"loadTools",
	"updatePlan",
]);

const SUMMARISED_OUTPUT_TYPES = new Set([
	"json",
	"text",
	"content",
]);

/**
 * Keeps every tool call and input but replaces the outputs of finished turns
 * with their summary line; the turn in progress stays as sent. Errors,
 * denials and approvals stay; calls of disabled display tools are dropped.
 * Reasoning survives only from the turn's latest tool-set change on: a
 * `loadTools` result, or an `updatePlan` that ran and so unlocked tools.
 */
export const pruneAssistantHistory = (
	messages: ModelMessage[],
	{
		lines,
		displayToolNames,
		enabledDisplayToolNames,
	}: AssistantHistoryPruningOptions,
): ModelMessage[] => {
	const disabledDisplayToolNames = displayToolNames.filter(
		(name) => !enabledDisplayToolNames.includes(name),
	);
	const pruned =
		disabledDisplayToolNames.length > 0
			? pruneMessages({
					messages,
					toolCalls: [
						{
							type: "all",
							tools: disabledDisplayToolNames,
						},
					],
					emptyMessages: "remove",
				})
			: messages;

	const turnStart = currentTurnStart(pruned);
	const latestLoad = pruned
		.map(
			(message) =>
				message.role === "tool" &&
				message.content.some(
					(part) =>
						part.type === "tool-result" &&
						TOOL_SET_CHANGING_TOOLS.has(part.toolName) &&
						part.output.type !== "execution-denied",
				),
		)
		.lastIndexOf(true);
	const enabledDisplay = new Set(enabledDisplayToolNames);

	return dropEarlierReasoning(
		pruned.map((message, index) =>
			message.role === "tool" && index < turnStart
				? {
						...message,
						content: message.content.map((part) =>
							part.type === "tool-result" &&
							SUMMARISED_OUTPUT_TYPES.has(part.output.type) &&
							!enabledDisplay.has(part.toolName)
								? {
										...part,
										output: {
											type: "text" as const,
											value:
												lines.get(part.toolCallId) ??
												`Called ${part.toolName}; its output is no longer available`,
										},
									}
								: part,
						),
					}
				: message,
		),
		Math.max(turnStart, latestLoad),
	);
};
