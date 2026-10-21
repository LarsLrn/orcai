import type { ChatStatus } from "ai";
import {
	type ClientToolName,
	isToolOfKind,
	type ToolName,
	type ToolNameOf,
} from "@/lib/ai/tools/registry";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import {
	type ToolCloseCode,
	toolCloseCode,
} from "@/lib/ai/utils/close-pending-tool-parts";
import { pausesTurn, stepPause } from "./paused-step";
import {
	isPlanPart,
	isPlanUpdating,
	latestPlanPart,
	type ShownPlanPart,
} from "./plan";

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
type FilePart = Extract<
	MessagePart,
	{
		type: "file";
	}
>;
/** The part of a call of tool `Name`. */
export type ToolPartOf<Name extends ToolName> = Extract<
	MessagePart,
	{
		type: `tool-${Name}`;
	}
>;
type DisplayPart = ToolPartOf<ToolNameOf<"display">>;

export type { ClientToolName };
export type ClientToolPart = ToolPartOf<ClientToolName>;
export type { ShownPlanPart };

export type ToolStatus =
	| "approved"
	| "awaiting-approval"
	| "awaiting-input"
	| "denied"
	| "failed"
	| "interrupted"
	| "running"
	| "skipped";

/** A step in the work log; ids follow part order. */
export type WorkEntry = {
	id: string;
} & (
	| {
			kind: "reasoning";
			part: ReasoningPart;
			/** Still arriving; a part left streaming after the turn ended is not. */
			live: boolean;
	  }
	| {
			kind: "text";
			part: TextPart;
	  }
	| {
			kind: "tool";
			part: ToolPart;
			/** Null for a finished call. */
			status: ToolStatus | null;
	  }
);

/** A part of the answer; a paused step's calls can be answered only while the chat is idle. */
export type AnswerPart =
	| {
			kind: "text";
			part: TextPart;
	  }
	| {
			kind: "file";
			part: FilePart;
	  }
	| {
			kind: "display";
			part: DisplayPart;
	  }
	| {
			kind: "approval";
			part: ToolPart;
			status: ToolStatus | null;
			answerable: boolean;
	  }
	| {
			kind: "client";
			part: ClientToolPart;
			status: ToolStatus | null;
			answerable: boolean;
	  };

/** What a running turn is doing while no answer text streams. */
export type Activity =
	| {
			kind: "tool";
			part: ToolPart;
	  }
	| {
			kind: "thinking";
	  }
	| {
			kind: "working";
	  };

/**
 * What a reply shows where its answer would be: the wait for its first part
 * while it runs, nothing until its request settles, or why a settled reply
 * has no answer.
 */
type MissingAnswer = "waiting" | "pending" | "step-limit" | "no-answer";

export interface MessageView {
	message: ChatAgentUIMessage;
	/** Its parts are still arriving. */
	running: boolean;
	workLog: WorkEntry[];
	answer: AnswerPart[];
	missing: MissingAnswer | undefined;
	/** Set while the message runs and no answer text streams. */
	activity: Activity | undefined;
	/** Its paused step is answered but has not run, as after a reload. */
	canContinue: boolean;
}

export interface TurnPlan {
	part: ShownPlanPart;
	/** The latest reply is writing a new version. */
	updating: boolean;
	/** The proposals the idle chat waits on, oldest first. */
	approvalIds: string[];
}

export interface TurnView {
	/** One per message, in order. */
	messages: MessageView[];
	/** A turn is being sent or streamed. */
	busy: boolean;
	/** The conversation's plan: its newest shown `updatePlan` call. */
	plan: TurnPlan | undefined;
}

const isToolPart = (part: MessagePart): part is ToolPart =>
	part.type === "dynamic-tool" || part.type.startsWith("tool-");

/** A tool that does work, as opposed to a display primitive. */
const isWorkToolPart = (part: MessagePart) =>
	isToolPart(part) && !isToolOfKind(part, "display");

const isAnswerDisplayPart = (part: MessagePart) =>
	isToolOfKind(part, "display") && part.state !== "output-error";

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

const closedStatus = {
	superseded: "skipped",
	interrupted: "interrupted",
} as const satisfies Record<ToolCloseCode, ToolStatus>;

/**
 * A finished call has no status. An unfinished call runs while its message
 * does and was cut off once it ended. A call waiting on the user waits only
 * on the `latest` message; elsewhere a newer message skipped it.
 */
const toolStatus = (
	part: ToolPart,
	running: boolean,
	latest: boolean,
): ToolStatus | null => {
	switch (part.state) {
		case "output-available":
			return null;
		case "output-error": {
			const code = toolCloseCode(part.errorText);
			return code ? closedStatus[code] : "failed";
		}
		case "output-denied": {
			const code = toolCloseCode(part.approval.reason);
			return code ? closedStatus[code] : "denied";
		}
		case "approval-requested":
			return latest ? "awaiting-approval" : "skipped";
		case "approval-responded":
			if (!part.approval.approved) return "denied";
			return running ? "running" : "approved";
		default:
			if (running) return "running";
			if (part.state === "input-available" && isToolOfKind(part, "client")) {
				return latest ? "awaiting-input" : "skipped";
			}
			return "interrupted";
	}
};

const missingAnswer = (
	message: ChatAgentUIMessage,
	{
		running,
		settled,
		answer,
	}: {
		running: boolean;
		settled: boolean;
		answer: readonly AnswerPart[];
	},
): MissingAnswer | undefined => {
	if (message.role !== "assistant") {
		return undefined;
	}
	if (!settled) {
		if (message.parts.length > 0) return undefined;
		return running ? "waiting" : "pending";
	}
	if (answer.length > 0) {
		return undefined;
	}
	return message.metadata?.stepLimitReached ? "step-limit" : "no-answer";
};

/** The step under way, if the work log ends on one. */
const activeStep = (entries: readonly WorkEntry[]): Activity | undefined => {
	const last = entries.at(-1);

	if (last?.kind === "tool" && last.status === "running") {
		return {
			kind: "tool",
			part: last.part,
		};
	}
	if (last?.kind === "reasoning" && last.live) {
		return {
			kind: "thinking",
		};
	}
	return undefined;
};

/**
 * Splits a message's parts into the work log and the answer, both in stream
 * order. Text right before a working tool call is progress and goes to the
 * work log; other text and display primitives are the answer. A finished
 * turn whose answer would be empty shows its last text as the answer.
 * A paused step's text and the calls it waits on, client calls included, are
 * the answer too, except a plan, which the plan panel approves.
 */
const viewMessage = (
	message: ChatAgentUIMessage,
	{
		latest,
		status,
	}: {
		latest: boolean;
		status: ChatStatus;
	},
): MessageView => {
	const { parts } = message;
	const busy = status === "submitted" || status === "streaming";
	const running = latest && status === "streaming";
	const idle = latest && !busy;
	const paused = running ? undefined : stepPause(parts, latest);
	const isPausedAnswer = (part: MessagePart, index: number) =>
		paused !== undefined &&
		index >= paused.start &&
		pausesTurn(part, latest) &&
		!isPlanPart(part);
	const statusOf = (part: ToolPart) => toolStatus(part, running, latest);

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

	const answerPartOf = (
		part: MessagePart,
		index: number,
	): AnswerPart | undefined => {
		if (part.type === "text") {
			return interim.has(index) || isBlankText(part)
				? undefined
				: {
						kind: "text",
						part,
					};
		}
		if (part.type === "file") {
			return {
				kind: "file",
				part,
			};
		}
		if (!isToolPart(part)) {
			return undefined;
		}
		if (isPausedAnswer(part, index)) {
			return isToolOfKind(part, "client")
				? {
						kind: "client",
						part,
						status: statusOf(part),
						answerable: idle && part.state === "input-available",
					}
				: {
						kind: "approval",
						part,
						status: statusOf(part),
						answerable: idle && part.state === "approval-requested",
					};
		}
		return isAnswerDisplayPart(part)
			? {
					kind: "display",
					part,
				}
			: undefined;
	};

	let answer = parts.flatMap((part, index) => answerPartOf(part, index) ?? []);

	if (!running && answer.length === 0) {
		const index = parts.reduce(
			(found, part, at) =>
				part.type === "text" && !isBlankText(part) ? at : found,
			-1,
		);
		const lastText = parts[index];
		if (lastText?.type === "text") {
			interim.delete(index);
			answer = [
				{
					kind: "text",
					part: lastText,
				},
			];
		}
	}

	const workLog: WorkEntry[] = [];
	parts.forEach((part, index) => {
		const id = String(index);

		if (part.type === "reasoning") {
			const live = running && part.state === "streaming";
			if (!live && part.text.trim() === "") return;
			workLog.push({
				id,
				kind: "reasoning",
				part,
				live,
			});
		} else if (
			isToolPart(part) &&
			!isAnswerDisplayPart(part) &&
			!isPausedAnswer(part, index)
		) {
			workLog.push({
				id,
				kind: "tool",
				part,
				status: statusOf(part),
			});
		} else if (
			part.type === "text" &&
			interim.has(index) &&
			!isBlankText(part)
		) {
			workLog.push({
				id,
				kind: "text",
				part,
			});
		}
	});

	const lastPart = parts.at(-1);
	const writing = lastPart?.type === "text" && lastPart.state === "streaming";

	return {
		message,
		running,
		workLog,
		answer,
		missing: missingAnswer(message, {
			running,
			settled: !latest || !busy,
			answer,
		}),
		activity:
			running && !writing
				? (activeStep(workLog) ?? {
						kind: "working",
					})
				: undefined,
		canContinue:
			idle && message.role === "assistant" && paused?.answered === true,
	};
};

const planOf = (
	messages: readonly ChatAgentUIMessage[],
	busy: boolean,
): TurnPlan | undefined => {
	const part = latestPlanPart(messages);

	if (!part) {
		return undefined;
	}

	const last = messages.at(-1);
	const paused =
		!busy && last?.role === "assistant"
			? stepPause(last.parts, true)
			: undefined;

	return {
		part,
		updating: busy && last !== undefined && isPlanUpdating(last),
		approvalIds: (paused?.approvals ?? [])
			.filter(isPlanPart)
			.map((call) => call.approval.id),
	};
};

/**
 * How a chat reads at its status: per message the work log with each call's
 * status, the answer with what can still be answered, why an answer is
 * missing, the running activity and whether a paused step can continue; for
 * the conversation its plan. Only the latest message can be running, paused
 * or answered.
 */
export const turnView = (
	messages: readonly ChatAgentUIMessage[],
	status: ChatStatus,
): TurnView => {
	const busy = status === "submitted" || status === "streaming";

	return {
		messages: messages.map((message, index) =>
			viewMessage(message, {
				latest: index === messages.length - 1,
				status,
			}),
		),
		busy,
		plan: planOf(messages, busy),
	};
};
