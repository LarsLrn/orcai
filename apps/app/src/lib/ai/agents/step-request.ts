import { withholdToolCalls } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import {
	isStepCount,
	type ModelMessage,
	type StepResult,
	type StopCondition,
	type ToolSet,
} from "ai";
import type { z } from "zod/v4";
import type { stepBudgetOptionsSchema } from "@/lib/ai/agents/step-budget";
import {
	stepFailures,
	type ToolFailure,
	withStoredToolFailures,
} from "@/lib/ai/agents/turn-history";
import { fitStep } from "@/lib/ai/turn/context-window";

export const FINAL_STEP_NOTE =
	"This is the last step of this turn: no more tools can run. Answer the user now from what you have so far, and say briefly what you could not finish.";

/**
 * Shapes every step's request the same way for each agent: failures as the
 * stored reply reads them, then the agent's pruning, then the turn's prompt
 * room, then on the budget's last step a note asking for an answer. The note
 * comes last so pruning never mistakes it for a new turn, and as a user
 * message it keeps the prompt prefix as it was. A turn whose next step would
 * not fit its prompt room even without the earlier steps' tool calls stops.
 */
export const createStepShaper = (params: {
	providerKind: ProviderKind;
	prune: (messages: ModelMessage[]) => ModelMessage[];
}) => {
	// Calls approved in an earlier request fail before the first step, outside every step's content.
	const executionFailures: ToolFailure[] = [];
	let contextFull = false;

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
		/** Whether the turn stopped because its next step would not fit. */
		contextFull: () => contextFull,
		forTurn: <TOOLS extends ToolSet>({
			maxSteps,
			promptTokens,
		}: z.infer<typeof stepBudgetOptionsSchema>) => {
			const shape = (
				messages: ModelMessage[],
				steps: readonly StepResult<TOOLS>[],
			) => {
				const shaped = params.prune(
					withStoredToolFailures(messages, [
						...executionFailures,
						...stepFailures(steps),
					]),
				);
				return promptTokens === undefined
					? shaped
					: fitStep(shaped, promptTokens);
			};
			let sent: ModelMessage[] = [];
			const nextStepFits: StopCondition<TOOLS> = ({ steps }) => {
				const last = steps.at(-1);
				contextFull =
					promptTokens !== undefined &&
					last?.finishReason === "tool-calls" &&
					shape(
						[
							...sent,
							...last.response.messages,
						],
						steps,
					) === undefined;
				return contextFull;
			};

			return {
				stopWhen: [
					isStepCount(maxSteps),
					nextStepFits,
				],
				prepareStep: ({
					stepNumber,
					messages,
					steps,
				}: {
					stepNumber: number;
					messages: ModelMessage[];
					steps: readonly StepResult<TOOLS>[];
				}) => {
					sent = shape(messages, steps) ?? messages;
					return stepNumber < maxSteps - 1
						? {
								messages: sent,
							}
						: {
								...withholdToolCalls(params.providerKind),
								messages: [
									...sent,
									{
										role: "user" as const,
										content: FINAL_STEP_NOTE,
									},
								],
							};
				},
			};
		},
	};
};
