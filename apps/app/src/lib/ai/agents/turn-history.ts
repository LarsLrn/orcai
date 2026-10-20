import type { ModelMessage, StepResult, ToolSet } from "ai";
import { streamErrorText } from "@/lib/ai/utils/stream-error-text";

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

/** A failed tool call, as a step's content or a tool execution reports it. */
export type ToolFailure = {
	toolCallId: string;
	error: unknown;
};

/** The failed calls of the steps so far, including calls the SDK could not run. */
export const stepFailures = <TOOLS extends ToolSet>(
	steps: readonly StepResult<TOOLS>[],
): ToolFailure[] =>
	steps.flatMap((step) =>
		step.content.filter((part) => part.type === "tool-error"),
	);

/** How the SDK words a denial without a reason, stored or not. */
const DENIED_TEXT = "Tool call execution denied.";

/**
 * Sends failed and denied calls as the stored reply does. The SDK sends a
 * failure's `toString()` and a denial as `execution-denied`, but reads a
 * stored reply back as its `streamErrorText` and an `error-text` denial, so
 * sending those from the start keeps the turn as sent once stored.
 */
export const withStoredToolFailures = (
	messages: ModelMessage[],
	failures: readonly ToolFailure[],
): ModelMessage[] => {
	const texts = new Map(
		failures.map(({ toolCallId, error }) => [
			toolCallId,
			streamErrorText(error),
		]),
	);

	return messages.map((message) =>
		message.role === "tool"
			? {
					...message,
					content: message.content.map((part) => {
						if (part.type !== "tool-result") {
							return part;
						}
						if (part.output.type === "execution-denied") {
							return {
								...part,
								output: {
									type: "error-text",
									value: part.output.reason ?? DENIED_TEXT,
								},
							};
						}
						const text = texts.get(part.toolCallId);
						return part.output.type === "error-text" && text !== undefined
							? {
									...part,
									output: {
										...part.output,
										value: text,
									},
								}
							: part;
					}),
				}
			: message,
	);
};
