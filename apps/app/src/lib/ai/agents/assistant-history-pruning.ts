import { type ModelMessage, pruneMessages, type ToolContent } from "ai";
import {
	currentTurnStart,
	dropEarlierReasoning,
} from "@/lib/ai/agents/turn-history";

export interface AssistantHistoryPruningOptions {
	/** Summary line per tool call id. */
	lines: ReadonlyMap<string, string>;
	/** Every content tool name, enabled or not. */
	contentToolNames: readonly string[];
	/** Content tools offered this turn; their calls stay in history in full. */
	enabledContentToolNames: readonly string[];
	/** The calls whose results changed the request's tool list. */
	toolListChanges: ReadonlySet<string>;
}

/** Outputs of calls that ran and succeeded; denials and failures arrive as errors. */
const SUCCEEDED_OUTPUT_TYPES = new Set([
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
 * denials and approvals stay; calls of disabled content tools are dropped.
 * Reasoning survives only from the turn's latest result that changed the
 * tool list on.
 */
export const pruneAssistantHistory = (
	messages: ModelMessage[],
	{
		lines,
		contentToolNames,
		enabledContentToolNames,
		toolListChanges,
	}: AssistantHistoryPruningOptions,
): ModelMessage[] => {
	const disabledContentToolNames = contentToolNames.filter(
		(name) => !enabledContentToolNames.includes(name),
	);
	const pruned =
		disabledContentToolNames.length > 0
			? pruneMessages({
					messages,
					toolCalls: [
						{
							type: "all",
							tools: disabledContentToolNames,
						},
					],
					emptyMessages: "remove",
				})
			: messages;

	const turnStart = currentTurnStart(pruned);
	const latestChange = pruned
		.map(
			(message) =>
				message.role === "tool" &&
				message.content.some(
					(part) =>
						part.type === "tool-result" && toolListChanges.has(part.toolCallId),
				),
		)
		.lastIndexOf(true);
	const enabledContent = new Set(enabledContentToolNames);

	return dropEarlierReasoning(
		pruned.map((message, index) =>
			message.role === "tool" && index < turnStart
				? {
						...message,
						content: message.content.map((part) =>
							part.type === "tool-result" &&
							SUCCEEDED_OUTPUT_TYPES.has(part.output.type) &&
							!enabledContent.has(part.toolName)
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
		Math.max(turnStart, latestChange),
	);
};
