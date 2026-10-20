import { withholdToolCalls } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import type { ModelMessage } from "ai";
import { z } from "zod/v4";

// Model calls a turn may make, and so the most requests its quota reserves.
export const CHAT_AGENT_MAX_STEPS = 25;
export const ASSISTANT_AGENT_MAX_STEPS = 20;

/** A turn's step budget: the agent's limit, or fewer when a request quota has less left. */
export const stepBudgetOptionsSchema = z.object({
	maxSteps: z.number().int().positive(),
});

export const FINAL_STEP_NOTE =
	"This is the last step of this turn: no more tools can run. Answer the user now from what you have so far, and say briefly what you could not finish.";

/**
 * The last step the budget allows answers instead of calling tools. The note
 * is appended as a user message, so the prompt prefix stays as it was.
 */
export const finalStepSettings = (params: {
	stepNumber: number;
	maxSteps: number;
	messages: ModelMessage[];
	providerKind: ProviderKind;
}) =>
	params.stepNumber < params.maxSteps - 1
		? undefined
		: {
				...withholdToolCalls(params.providerKind),
				messages: [
					...params.messages,
					{
						role: "user" as const,
						content: FINAL_STEP_NOTE,
					},
				],
			};
