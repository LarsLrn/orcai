import { type ModelMessage, pruneMessages, type ToolContent } from "ai";
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
	/** Whether loading tools or approving a plan changes the request's tool list. */
	toolListChanges: boolean;
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

type ToolOutput = Extract<
	ToolContent[number],
	{
		type: "tool-result";
	}
>["output"];

/** The summary line, plus the output's tool references, which keep the tools they loaded loaded. */
const summarisedOutput = (output: ToolOutput, line: string): ToolOutput => {
	const references =
		output.type === "content"
			? output.value.filter((part) => part.type === "custom")
			: [];

	return references.length > 0
		? {
				type: "content",
				value: [
					{
						type: "text",
						text: line,
					},
					...references,
				],
			}
		: {
				type: "text",
				value: line,
			};
};

/**
 * Keeps every tool call and input but replaces the outputs of finished turns
 * with their summary line; the turn in progress stays as sent. Errors,
 * denials and approvals stay; calls of disabled display tools are dropped.
 * Where the tool list changes, reasoning survives only from the turn's latest
 * change on: a `loadTools` result, or an `updatePlan` that ran and so
 * unlocked tools.
 */
export const pruneAssistantHistory = (
	messages: ModelMessage[],
	{
		lines,
		displayToolNames,
		enabledDisplayToolNames,
		toolListChanges,
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
										output: summarisedOutput(
											part.output,
											lines.get(part.toolCallId) ??
												`Called ${part.toolName}; its output is no longer available`,
										),
									}
								: part,
						),
					}
				: message,
		),
		toolListChanges ? Math.max(turnStart, latestLoad) : turnStart,
	);
};
