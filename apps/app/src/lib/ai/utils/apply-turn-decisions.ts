import type { ChatMessageMetadata, ToolApprovalDecision } from "@orcai/schema";
import { isToolUIPart, type UIMessage } from "ai";

type Parts = UIMessage["parts"];
type Part = Parts[number];

export type TurnDecisionsRejection =
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
 * Answers the approvals a paused reply waits for. The reply must be the
 * chat's last row, not claimed by a running continuation, and the decisions
 * must answer every approval its last step requests and nothing else. A
 * decision repeating a stored answer is accepted. No decisions resume a last
 * step that was answered but has not run.
 */
export const applyTurnDecisions = ({
	messageId,
	lastMessage,
	decisions,
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
	const stepStart = parts.reduce(
		(start, part, index) => (part.type === "step-start" ? index + 1 : start),
		0,
	);
	const lastStep = parts.slice(stepStart).filter(isToolUIPart);
	const requested = lastStep.filter(
		(part) => part.state === "approval-requested",
	);

	if (decisions.length === 0) {
		if (requested.length > 0) {
			return reject(
				"CHAT_TURN_DECISIONS_INCOMPLETE",
				"Every pending approval needs an answer.",
			);
		}

		return lastStep.some((part) => part.state === "approval-responded")
			? {
					ok: true,
					parts,
				}
			: reject("CHAT_TURN_NOT_AWAITING", "The reply is not waiting to run.");
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
		lastStep.flatMap((part) =>
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

	if (requested.some((part) => !decisionById.has(part.approval.id))) {
		return reject(
			"CHAT_TURN_DECISIONS_INCOMPLETE",
			"Every pending approval needs an answer.",
		);
	}

	return {
		ok: true,
		parts: parts.map((part, index): Part => {
			if (
				index < stepStart ||
				!isToolUIPart(part) ||
				part.state !== "approval-requested"
			) {
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
