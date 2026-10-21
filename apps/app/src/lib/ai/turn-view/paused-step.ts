import type { ClientToolOutput, ToolApprovalDecision } from "@orcai/schema";
import { isToolUIPart, type UIMessage } from "ai";
import { isClientToolPart } from "@/lib/ai/tools/assistant/client-tools";
import { toolCloseCode } from "@/lib/ai/utils/close-pending-tool-parts";

type AnyPart = UIMessage["parts"][number];

type CallOf<P extends AnyPart> = Extract<
	P,
	{
		toolCallId: string;
	}
>;

type ApprovalRequestOf<P extends AnyPart> = Extract<
	CallOf<P>,
	{
		state: "approval-requested";
	}
>;

export interface PausedStep<P extends AnyPart> {
	/** Index of the step's first part. */
	start: number;
	/** Every call of the step. */
	calls: CallOf<P>[];
	/** Calls still asking for approval. */
	approvals: ApprovalRequestOf<P>[];
	/** Client calls still waiting for the browser's result. */
	awaiting: CallOf<P>[];
	/** Every call the step waits on has its answer; only the continuation is missing. */
	answered: boolean;
	/** The answers the step holds, as a continuation sends them. */
	answers: {
		approvals: ToolApprovalDecision[];
		toolOutputs: ClientToolOutput[];
	};
}

/** A call the turn waits on: asked for approval, or answered but not run yet. */
export const isPausingCall = (part: AnyPart) =>
	isToolUIPart(part) &&
	(part.state === "approval-requested" || part.state === "approval-responded");

/**
 * A client call the user can answer or has answered. One the server closed,
 * or whose input never finished streaming, waits on nobody.
 */
const isUserClientCall = (part: AnyPart) =>
	isClientToolPart(part) &&
	(part.state === "input-available" ||
		part.state === "output-available" ||
		(part.state === "output-error" &&
			toolCloseCode(part.errorText) === undefined));

/** Client calls wait only on the chat's latest message; elsewhere a newer message skipped them. */
export const pausesTurn = (part: AnyPart, latest: boolean) =>
	isPausingCall(part) || (latest && isUserClientCall(part));

const isPending = (part: AnyPart) =>
	isToolUIPart(part) &&
	(part.state === "approval-requested" || part.state === "input-available");

const answersOf = (
	calls: readonly AnyPart[],
): PausedStep<AnyPart>["answers"] => ({
	approvals: calls.flatMap((part) =>
		isToolUIPart(part) && part.state === "approval-responded"
			? [
					{
						approvalId: part.approval.id,
						approved: part.approval.approved,
						reason: part.approval.reason,
					},
				]
			: [],
	),
	toolOutputs: calls.flatMap((part): ClientToolOutput[] => {
		if (!isToolUIPart(part) || !isUserClientCall(part)) return [];
		switch (part.state) {
			case "output-available":
				return [
					{
						toolCallId: part.toolCallId,
						output: part.output,
					},
				];
			case "output-error":
				return [
					{
						toolCallId: part.toolCallId,
						errorText: part.errorText,
					},
				];
			default:
				return [];
		}
	}),
});

/** The last step, the parts after the last `step-start`, while it waits on the user for one of its calls. */
export const stepPause = <P extends AnyPart>(
	parts: readonly P[],
	latest: boolean,
): PausedStep<P> | undefined => {
	let start = 0;
	parts.forEach((part, index) => {
		if (part.type === "step-start") start = index + 1;
	});
	const calls = parts
		.slice(start)
		.filter((part): part is CallOf<P> => isToolUIPart(part));
	const pausing = calls.filter((part) => pausesTurn(part, latest));

	if (pausing.length === 0) {
		return undefined;
	}

	return {
		start,
		calls,
		approvals: calls.filter(
			(part): part is ApprovalRequestOf<P> =>
				part.state === "approval-requested",
		),
		awaiting: calls.filter(
			(part) => isClientToolPart(part) && part.state === "input-available",
		),
		answered: !pausing.some(isPending),
		answers: answersOf(calls),
	};
};

/**
 * The step a chat's latest reply waits on once its stream has ended: its
 * pending approvals and client calls, whether all are answered, and the
 * answers a continuation sends. The browser and the server read it alike.
 */
export const pausedStep = <P extends AnyPart>(message: {
	role: string;
	parts: readonly P[];
}): PausedStep<P> | undefined =>
	message.role === "assistant" ? stepPause(message.parts, true) : undefined;
