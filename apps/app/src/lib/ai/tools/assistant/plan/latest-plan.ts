import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import type { AssistantToolPart } from "../summary";

type MessagePart = ChatAgentUIMessage["parts"][number];

export type PlanPart = AssistantToolPart<"updatePlan">;

/** A complete call that holds the plan: run, waiting for approval, or approved. */
export type ShownPlanPart = Extract<
	PlanPart,
	{
		state: "output-available" | "approval-requested" | "approval-responded";
	}
>;

export const isPlanPart = (part: MessagePart): part is PlanPart =>
	part.type === "tool-updatePlan";

/** A proposal counts only on the latest reply; a later message superseded it. */
const isShownPlanPart = (
	part: MessagePart,
	isLatest: boolean,
): part is ShownPlanPart =>
	isPlanPart(part) &&
	(part.state === "output-available" ||
		(isLatest &&
			(part.state === "approval-requested" ||
				(part.state === "approval-responded" && part.approval.approved))));

/** The plan of the conversation: its newest shown `updatePlan` call. */
export const latestPlanPart = (
	messages: readonly Pick<ChatAgentUIMessage, "parts">[],
): ShownPlanPart | undefined =>
	messages
		.flatMap((message, index) =>
			message.parts.filter((part): part is ShownPlanPart =>
				isShownPlanPart(part, index === messages.length - 1),
			),
		)
		.at(-1);

/** The approval ids of the proposals a reply waits on. */
export const pendingPlanApprovalIds = (
	message: Pick<ChatAgentUIMessage, "parts">,
): string[] =>
	message.parts.filter(isPlanPart).flatMap((part) =>
		part.state === "approval-requested"
			? [
					part.approval.id,
				]
			: [],
	);

/** Whether a reply's newest `updatePlan` call is still arriving or running. */
export const isPlanUpdating = (
	message: Pick<ChatAgentUIMessage, "parts">,
): boolean => {
	const state = message.parts.filter(isPlanPart).at(-1)?.state;

	return state === "input-streaming" || state === "input-available";
};
