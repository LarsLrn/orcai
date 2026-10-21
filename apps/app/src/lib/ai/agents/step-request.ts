import { withholdToolCalls } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import type { ModelMessage, StepResult, ToolSet } from "ai";
import {
	stepFailures,
	type ToolFailure,
	withStoredToolFailures,
} from "@/lib/ai/agents/turn-history";

export const FINAL_STEP_NOTE =
	"This is the last step of this turn: no more tools can run. Answer the user now from what you have so far, and say briefly what you could not finish.";

/**
 * Shapes every step's request the same way for each agent: failures as the
 * stored reply reads them, then the agent's pruning, then on the budget's
 * last step a note asking for an answer. The note comes last so pruning
 * never mistakes it for a new turn, and as a user message it keeps the
 * prompt prefix as it was.
 */
export const createStepShaper = (params: {
	providerKind: ProviderKind;
	prune: (messages: ModelMessage[]) => ModelMessage[];
}) => {
	// Calls approved in an earlier request fail before the first step, outside every step's content.
	const executionFailures: ToolFailure[] = [];

	return {
		/** Feed every tool execution end, so failures outside a step's content are sent as stored. */
		recordExecution: (
			output:
				| {
						type: "tool-result";
				  }
				| ({
						type: "tool-error";
				  } & ToolFailure),
		) => {
			if (output.type === "tool-error") {
				executionFailures.push(output);
			}
		},
		prepareStep:
			(maxSteps: number) =>
			<TOOLS extends ToolSet>({
				stepNumber,
				messages,
				steps,
			}: {
				stepNumber: number;
				messages: ModelMessage[];
				steps: readonly StepResult<TOOLS>[];
			}) => {
				const shaped = params.prune(
					withStoredToolFailures(messages, [
						...executionFailures,
						...stepFailures(steps),
					]),
				);
				return stepNumber < maxSteps - 1
					? {
							messages: shaped,
						}
					: {
							...withholdToolCalls(params.providerKind),
							messages: [
								...shaped,
								{
									role: "user" as const,
									content: FINAL_STEP_NOTE,
								},
							],
						};
			},
	};
};
