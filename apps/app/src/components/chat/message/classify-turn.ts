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

const isStepPart = (part: MessagePart): part is ReasoningPart | ToolPart =>
	part.type === "reasoning" || isToolPart(part);

/**
 * Splits a turn's parts into the work log and the answer. Parts arrive in
 * stream order, so text before the last step is an intermediate response and
 * text after it is the answer.
 */
export const classifyTurn = (parts: readonly MessagePart[]): ClassifiedTurn => {
	let lastStepIndex = -1;
	parts.forEach((part, index) => {
		if (isStepPart(part)) {
			lastStepIndex = index;
		}
	});

	const entries: WorkEntry[] = [];
	const answerParts: MessagePart[] = [];

	parts.forEach((part, index) => {
		const id = String(index);

		if (part.type === "reasoning") {
			entries.push({
				id,
				kind: "reasoning",
				part,
			});
		} else if (isToolPart(part)) {
			entries.push({
				id,
				kind: "tool",
				part,
			});
		} else if (part.type === "text" && index < lastStepIndex) {
			if (part.text.trim() !== "") {
				entries.push({
					id,
					kind: "text",
					part,
				});
			}
		} else if (part.type === "text" || part.type === "file") {
			answerParts.push(part);
		}
	});

	return {
		entries,
		answerParts,
	};
};
