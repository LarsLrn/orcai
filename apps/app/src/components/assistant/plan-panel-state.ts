import { isPlanFinished } from "@/lib/ai/tools/assistant/plan/plan-tally";
import type { ShownPlanPart } from "@/lib/ai/turn-view/turn-view";

export interface PlanView {
	title: string;
	finished: boolean;
	awaitingApproval: boolean;
}

export const planViewOf = (part: ShownPlanPart): PlanView => ({
	title: part.input.title,
	finished: isPlanFinished(part.input.items),
	awaitingApproval: part.state === "approval-requested",
});

/**
 * Whether the panel is open after the plan changed: a new title or a plan
 * waiting for approval opens it, finishing the plan collapses it once, and
 * otherwise the user's toggle holds.
 */
export const nextPlanOpen = ({
	previous,
	next,
	open,
}: {
	previous: PlanView | undefined;
	next: PlanView;
	open: boolean;
}): boolean => {
	if (!previous || previous.title !== next.title || next.awaitingApproval) {
		return true;
	}
	if (!previous.finished && next.finished) {
		return false;
	}
	return open;
};

/** Model-facing reason for a proposal an answer to a newer one replaced. */
export const SUPERSEDED_PLAN_REASON =
	"Not used: a newer plan from the same step was answered instead.";

/**
 * Answers every proposal the reply waits on: the newest, which the panel
 * shows, as the user chose, and the older ones as superseded.
 */
export const planApprovalAnswers = (
	approvalIds: readonly string[],
	answer: {
		approved: boolean;
		reason?: string;
	},
) =>
	approvalIds.map((id, index) =>
		index === approvalIds.length - 1
			? {
					id,
					...answer,
				}
			: {
					id,
					approved: false,
					reason: SUPERSEDED_PLAN_REASON,
				},
	);
