import type {
	ChatMessageMetadata,
	ClientToolOutput,
	ToolApprovalDecision,
} from "@orcai/schema";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { clientOutputSchema, toolKindOf } from "@/lib/ai/tools/registry";
import { pausedStep } from "@/lib/ai/turn-view/paused-step";

type Parts = UIMessage["parts"];
type Part = Parts[number];

export type TurnDecisionsRejection =
	| "CHAT_TOOL_OUTPUT_INVALID"
	| "CHAT_TURN_DECISIONS_INCOMPLETE"
	| "CHAT_TURN_NOT_AWAITING";

export type AppliedTurnDecisions =
	| {
			ok: true;
			parts: Parts;
	  }
	| {
			ok: false;
			reason: TurnDecisionsRejection;
			message: string;
	  };

const reject = (
	reason: TurnDecisionsRejection,
	message: string,
): AppliedTurnDecisions => ({
	ok: false,
	reason,
	message,
});

const approvalIdOf = (part: Part) =>
	isToolUIPart(part) ? part.approval?.id : undefined;

/** How long a started continuation holds its reply before a retry may take over. */
export const CONTINUATION_LEASE_MS = 10 * 60_000;

/** Whether a continuation stamped at `continuedAt` may still be running. */
export const isContinuationClaimLive = (
	continuedAt: string | undefined,
	now: Date,
) =>
	continuedAt !== undefined &&
	now.getTime() - Date.parse(continuedAt) < CONTINUATION_LEASE_MS;

export const withoutContinuationClaim = ({
	continuedAt: _,
	...metadata
}: ChatMessageMetadata): ChatMessageMetadata => metadata;

/**
 * Answers the approvals and client-tool calls a paused reply waits for. The
 * reply must be the chat's last row, not claimed by a running continuation,
 * and the answers must cover every pending part of its last step and nothing
 * else. An answer repeating a stored one is accepted and keeps the stored
 * one; a new tool output is validated against its tool's output schema. No
 * answers resume a last step that was answered but has not run.
 */
export const applyTurnDecisions = ({
	messageId,
	lastMessage,
	decisions,
	toolOutputs,
	now,
}: {
	messageId: string;
	lastMessage:
		| {
				id: string;
				role: string;
				parts: Parts;
				continuedAt?: string;
		  }
		| undefined;
	decisions: ToolApprovalDecision[];
	toolOutputs: ClientToolOutput[];
	now: Date;
}): AppliedTurnDecisions => {
	if (lastMessage?.id !== messageId) {
		return reject(
			"CHAT_TURN_NOT_AWAITING",
			"The conversation has moved on since this reply.",
		);
	}

	if (lastMessage.role !== "assistant") {
		return reject(
			"CHAT_TURN_DECISIONS_INCOMPLETE",
			"Only a reply can be continued.",
		);
	}

	if (isContinuationClaimLive(lastMessage.continuedAt, now)) {
		return reject(
			"CHAT_TURN_NOT_AWAITING",
			"The reply is already being continued.",
		);
	}

	const { parts } = lastMessage;
	const paused = pausedStep(lastMessage);

	if (!paused) {
		return reject("CHAT_TURN_NOT_AWAITING", "The reply is not waiting to run.");
	}

	if (decisions.length === 0 && toolOutputs.length === 0) {
		return paused.answered
			? {
					ok: true,
					parts,
				}
			: reject(
					"CHAT_TURN_DECISIONS_INCOMPLETE",
					"Every pending call needs an answer.",
				);
	}

	const decisionById = new Map(
		decisions.map((decision) => [
			decision.approvalId,
			decision,
		]),
	);

	if (decisionById.size !== decisions.length) {
		return reject(
			"CHAT_TURN_DECISIONS_INCOMPLETE",
			"Each approval can be answered once.",
		);
	}

	const knownIds = new Set(parts.map(approvalIdOf));
	const lastStepById = new Map(
		paused.calls.flatMap((part) =>
			part.approval
				? [
						[
							part.approval.id,
							part,
						] as const,
					]
				: [],
		),
	);

	for (const { approvalId, approved } of decisions) {
		if (!knownIds.has(approvalId)) {
			return reject(
				"CHAT_TURN_DECISIONS_INCOMPLETE",
				`Unknown approval ${approvalId}.`,
			);
		}

		const part = lastStepById.get(approvalId);
		const pending =
			part?.state === "approval-requested" ||
			(part?.state === "approval-responded" &&
				part.approval.approved === approved);

		if (!pending) {
			return reject(
				"CHAT_TURN_NOT_AWAITING",
				`Approval ${approvalId} is no longer pending.`,
			);
		}
	}

	const outputById = new Map<string, Part>();

	for (const answer of toolOutputs) {
		if (outputById.has(answer.toolCallId)) {
			return reject(
				"CHAT_TURN_DECISIONS_INCOMPLETE",
				"Each call can be answered once.",
			);
		}

		const part = paused.awaiting.find(
			(candidate) => candidate.toolCallId === answer.toolCallId,
		);
		const stored = paused.calls.find(
			(candidate) =>
				candidate.toolCallId === answer.toolCallId &&
				toolKindOf(candidate) === "client" &&
				(candidate.state === "output-available" ||
					candidate.state === "output-error"),
		);

		// A retry after a failed stream repeats outputs the reply already holds.
		if (stored) {
			outputById.set(answer.toolCallId, stored);
			continue;
		}

		if (!part) {
			return reject(
				"CHAT_TURN_NOT_AWAITING",
				`Call ${answer.toolCallId} is not waiting for a result.`,
			);
		}

		if ("errorText" in answer) {
			outputById.set(answer.toolCallId, {
				...part,
				state: "output-error",
				errorText: answer.errorText,
			} as Part);
			continue;
		}

		const toolName = getToolName(part);
		const parsed = clientOutputSchema(toolName)?.safeParse(answer.output);

		if (!parsed?.success) {
			return reject(
				"CHAT_TOOL_OUTPUT_INVALID",
				`The result for call ${answer.toolCallId} does not match ${toolName}'s output.`,
			);
		}

		outputById.set(answer.toolCallId, {
			...part,
			state: "output-available",
			output: parsed.data,
		} as Part);
	}

	if (
		paused.approvals.some((part) => !decisionById.has(part.approval.id)) ||
		paused.awaiting.some((part) => !outputById.has(part.toolCallId))
	) {
		return reject(
			"CHAT_TURN_DECISIONS_INCOMPLETE",
			"Every pending call needs an answer.",
		);
	}

	return {
		ok: true,
		parts: parts.map((part, index): Part => {
			if (index < paused.start || !isToolUIPart(part)) {
				return part;
			}

			const output = outputById.get(part.toolCallId);

			if (output) {
				return output;
			}

			if (part.state !== "approval-requested") {
				return part;
			}

			const { approved, reason } = decisionById.get(
				part.approval.id,
			) as ToolApprovalDecision;

			return {
				...part,
				state: "approval-responded",
				approval: {
					...part.approval,
					approved,
					...(reason === undefined
						? {}
						: {
								reason,
							}),
				},
			};
		}),
	};
};
