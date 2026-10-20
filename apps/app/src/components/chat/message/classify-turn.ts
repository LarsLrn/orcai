import { isDisplayToolPart } from "@/components/chat/gen-ui/catalog";
import { isClientToolPart } from "@/lib/ai/tools/assistant/client-tools";
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

const lastIndexWhere = (
	parts: readonly MessagePart[],
	predicate: (part: MessagePart) => boolean,
) => {
	for (let index = parts.length - 1; index >= 0; index--) {
		if (predicate(parts[index] as MessagePart)) return index;
	}
	return -1;
};

/** A call the turn waits on: asked for approval, or answered but not run yet. */
export const isPausingPart = (part: MessagePart): part is ToolPart =>
	isToolPart(part) &&
	(part.state === "approval-requested" || part.state === "approval-responded");

/** Only the latest message can still be answered; older client calls were skipped. */
const pausesTurn = (part: MessagePart, latest: boolean) =>
	isPausingPart(part) || (latest && isClientToolPart(part));

const isAnswered = (part: ToolPart) =>
	part.state !== "approval-requested" && part.state !== "input-available";

export interface PausedStep {
	/** Index of the step's first part. */
	start: number;
	/** Every pausing part has its answer; only the continuation is missing. */
	answered: boolean;
}

/**
 * The last step, the parts after the last `step-start`, while the turn waits
 * on the user for one of its calls.
 */
export const pausedStep = (
	parts: readonly MessagePart[],
	running: boolean,
	latest = true,
): PausedStep | undefined => {
	if (running) {
		return undefined;
	}

	const start = lastIndexWhere(parts, (part) => part.type === "step-start") + 1;
	const pausing = parts
		.slice(start)
		.filter((part): part is ToolPart => pausesTurn(part, latest));

	if (pausing.length === 0) {
		return undefined;
	}

	return {
		start,
		answered: pausing.every(isAnswered),
	};
};

/** Reasoning still arriving; a part left streaming after the turn ended is not. */
export const isLiveReasoning = (part: ReasoningPart, running: boolean) =>
	running && part.state === "streaming";

/** Settled reasoning without text, as models that omit their thinking send it. */
const isBlankReasoning = (part: ReasoningPart, running: boolean) =>
	!isLiveReasoning(part, running) && part.text.trim() === "";

/**
 * Splits a turn's parts into the work log and the answer, both in stream
 * order. Text right before a working tool call is progress and goes to the
 * work log; other text and display primitives are the answer. A finished
 * turn whose answer would be empty shows its last text as the answer.
 * A paused step's text and the calls it waits on, client calls such as the
 * upload widget included, are the answer too.
 */
export const classifyTurn = (
	parts: readonly MessagePart[],
	{
		running = false,
		latest = true,
	}: {
		running?: boolean;
		/** The chat's latest message, the only one whose client calls still wait. */
		latest?: boolean;
	} = {},
): ClassifiedTurn => {
	const paused = pausedStep(parts, running, latest);
	const isPausedAnswer = (part: MessagePart, index: number) =>
		paused !== undefined && index >= paused.start && pausesTurn(part, latest);

	const interim = new Set<number>();
	parts.forEach((part, index) => {
		if (
			part.type === "text" &&
			!(paused !== undefined && index >= paused.start) &&
			isInterimText(parts, index)
		) {
			interim.add(index);
		}
	});

	const answerIndexes = parts.flatMap((part, index) =>
		(part.type === "text" && !interim.has(index) && !isBlankText(part)) ||
		part.type === "file" ||
		isAnswerDisplayPart(part) ||
		isPausedAnswer(part, index)
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
			if (isBlankReasoning(part, running)) return;
			entries.push({
				id,
				kind: "reasoning",
				part,
			});
		} else if (
			isToolPart(part) &&
			!isAnswerDisplayPart(part) &&
			!isPausedAnswer(part, index)
		) {
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

/**
 * What a reply shows where its answer would be: the wait for its first part
 * while it runs, nothing until its request settles, or why a settled reply
 * has no answer.
 */
export const missingAnswer = (
	message: Pick<ChatAgentUIMessage, "role" | "parts" | "metadata">,
	{
		running,
		settled,
		answerParts,
	}: {
		running: boolean;
		/** The chat is no longer sending or streaming this reply. */
		settled: boolean;
		answerParts: readonly MessagePart[];
	},
): "waiting" | "pending" | "step-limit" | "no-answer" | undefined => {
	if (message.role !== "assistant") {
		return undefined;
	}
	if (!settled) {
		if (message.parts.length > 0) return undefined;
		return running ? "waiting" : "pending";
	}
	if (answerParts.length > 0) {
		return undefined;
	}
	return message.metadata?.stepLimitReached ? "step-limit" : "no-answer";
};
