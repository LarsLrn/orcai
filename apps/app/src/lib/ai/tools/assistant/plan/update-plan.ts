import { assistantTool } from "../procedure-tool";
import { planSchema } from "./plan";

/** No procedure behind it: the call's input is the plan. */
export const updatePlanTool = () =>
	assistantTool({
		description:
			"Set the plan for the current task: a short title and every step with its status (pending, in_progress, done, skipped). Keep titles and step labels to a few words and put a step's specifics in its details. Call it only once you know what the user wants; ask about unclear requirements in your answer first. Each call replaces the whole plan, so always send every step. The conversation's first plan waits for the user's approval, so propose it in full with every step pending. While you work, mark a step in_progress when you start it and done when it is finished, or skipped when it is no longer needed. Keep at most one step in_progress.",
		inputSchema: planSchema,
		execute: () => ({
			updated: true as const,
		}),
	});
