import type { z } from "zod/v4";
import type { AssistantSession } from "@/lib/ai/agents/assistant-session";
import { type AssistantTool, assistantTool } from "../procedure-tool";
import { planSchema } from "./plan";

export type UpdatePlanOutput = {
	updated: true;
	/** This call was the conversation's first plan, and the user approved it. */
	approved?: true;
	/** The create tools the approval of the conversation's first plan made callable. */
	unlockedTools?: string[];
};

/** No procedure behind it: the call's input is the plan. */
export const updatePlanTool = (
	session: AssistantSession,
): AssistantTool<z.infer<typeof planSchema>, UpdatePlanOutput> =>
	assistantTool<z.infer<typeof planSchema>, UpdatePlanOutput>({
		description:
			"Set the plan for the current task: a short title and every step with its status. pending: not started. in_progress: being worked on, at most one step. done: finished. skipped: no longer needed. Keep the title and step labels to a few words and put a step's specifics in its details. Each call replaces the whole plan, so send every step every time. The conversation's first plan waits for the user's approval, so propose it in full with every step pending.",
		inputSchema: planSchema,
		execute: () => {
			if (session.isPlanApproved()) {
				return {
					updated: true,
				};
			}
			const unlockedTools = session.unlockedByApproval();

			return {
				updated: true,
				approved: true,
				...(unlockedTools.length > 0
					? {
							unlockedTools,
						}
					: {}),
			};
		},
		toModelOutput: ({ output }) =>
			session.modelOutput(output, output.unlockedTools ?? []),
	});
