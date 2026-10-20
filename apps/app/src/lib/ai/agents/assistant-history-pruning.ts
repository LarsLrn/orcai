import { type ModelMessage, pruneMessages } from "ai";

export interface AssistantHistoryPruningOptions {
	/** Summary line per tool call id. */
	lines: ReadonlyMap<string, string>;
	/** Every display tool name, enabled or not. */
	displayToolNames: readonly string[];
	/** Display tools offered this turn; their calls stay in history in full. */
	enabledDisplayToolNames: readonly string[];
}

const SUMMARISED_OUTPUT_TYPES = new Set([
	"json",
	"text",
	"content",
]);

/**
 * Keeps every tool call and input but replaces the outputs outside the latest
 * step (the last assistant message's calls) with their summary line. Errors,
 * denials and approvals stay; calls of disabled display tools are dropped.
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

	const latest = pruned
		.slice()
		.reverse()
		.find((message) => message.role === "assistant");
	const latestCallIds = new Set(
		latest && Array.isArray(latest.content)
			? latest.content.flatMap((part) =>
					part.type === "tool-call"
						? [
								part.toolCallId,
							]
						: [],
				)
			: [],
	);
	const enabledDisplay = new Set(enabledDisplayToolNames);

	return pruned.map((message) =>
		message.role === "tool"
			? {
					...message,
					content: message.content.map((part) =>
						part.type === "tool-result" &&
						SUMMARISED_OUTPUT_TYPES.has(part.output.type) &&
						!latestCallIds.has(part.toolCallId) &&
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
	);
};
