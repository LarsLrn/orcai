import { z } from "zod/v4";

// Model calls a turn may make, and so the most requests its quota reserves.
export const CHAT_AGENT_MAX_STEPS = 25;
export const ASSISTANT_AGENT_MAX_STEPS = 20;

/** A turn's step budget: the agent's limit, or fewer when a request quota has less left. */
export const stepBudgetOptionsSchema = z.object({
	maxSteps: z.number().int().positive(),
});
