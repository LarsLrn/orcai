import { isDisplayToolPart } from "@/components/chat/gen-ui/catalog";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";

export type MessagePart = ChatAgentUIMessage["parts"][number];
export type ToolPart = Extract<
	MessagePart,
	{
		toolCallId: string;
	}
>;
export type ReasoningPart = Extract<
	MessagePart,
	{
		type: "reasoning";
	}
>;
export type TextPart = Extract<
	MessagePart,
	{
		type: "text";
	}
>;

export type WorkEntry = {
	id: string;
} & (
	| {
			kind: "reasoning";
			part: ReasoningPart;
	  }
	| {
			kind: "text";
			part: TextPart;
	  }
	| {
			kind: "tool";
			part: ToolPart;
	  }
);

export interface ClassifiedTurn {
	entries: WorkEntry[];
	answerParts: MessagePart[];
}

export const isToolPart = (part: MessagePart): part is ToolPart =>
	part.type === "dynamic-tool" || part.type.startsWith("tool-");

/** A tool that does work, as opposed to a display primitive. */
const isWorkToolPart = (part: MessagePart) =>
	isToolPart(part) && !isDisplayToolPart(part);

const isAnswerDisplayPart = (part: MessagePart) =>
	isDisplayToolPart(part) && part.state !== "output-error";

/** Text is interim when the next part, past reasoning and text, is a tool call that does work. */
const isInterimText = (parts: readonly MessagePart[], index: number) => {
	const next = parts
		.slice(index + 1)
		.find(
			(part) =>
				part.type !== "reasoning" &&
				part.type !== "text" &&
				part.type !== "step-start",
		);
	return next !== undefined && isWorkToolPart(next);
};

const isBlankText = (part: MessagePart) =>
	part.type === "text" && part.text.trim() === "";

/**
 * Splits a turn's parts into the work log and the answer, both in stream
 * order. Text right before a working tool call is progress and goes to the
 * work log; other text and display primitives are the answer. A finished
 * turn whose answer would be empty shows its last text as the answer.
 */
export const classifyTurn = (
	parts: readonly MessagePart[],
	{
		running = false,
	}: {
		running?: boolean;
	} = {},
): ClassifiedTurn => {
	const interim = new Set<number>();
	parts.forEach((part, index) => {
		if (part.type === "text" && isInterimText(parts, index)) {
			interim.add(index);
		}
	});

	const answerIndexes = parts.flatMap((part, index) =>
		(part.type === "text" && !interim.has(index) && !isBlankText(part)) ||
		part.type === "file" ||
		isAnswerDisplayPart(part)
			? [
					index,
				]
			: [],
	);

	if (!running && answerIndexes.length === 0) {
		const lastText = parts.reduce(
			(found, part, index) =>
				part.type === "text" && !isBlankText(part) ? index : found,
			-1,
		);
		if (lastText !== -1) {
			interim.delete(lastText);
			answerIndexes.push(lastText);
		}
	}

	const entries: WorkEntry[] = [];
	parts.forEach((part, index) => {
		const id = String(index);

		if (part.type === "reasoning") {
			entries.push({
				id,
				kind: "reasoning",
				part,
			});
		} else if (isToolPart(part) && !isAnswerDisplayPart(part)) {
			entries.push({
				id,
				kind: "tool",
				part,
			});
		} else if (
			part.type === "text" &&
			interim.has(index) &&
			!isBlankText(part)
		) {
			entries.push({
				id,
				kind: "text",
				part,
			});
		}
	});

	return {
		entries,
		answerParts: answerIndexes.map((index) => parts[index]),
	};
};
