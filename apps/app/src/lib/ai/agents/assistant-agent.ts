import { aiTelemetry } from "@orcai/ai";
import { type LanguageModel, Output, ToolLoopAgent } from "ai";
import { buildAssistantSystemPrompt } from "@/lib/ai/agents/assistant-system-prompt";
import type { ChatAgentGenerationParams } from "@/lib/ai/agents/chat-agent";
import { applyToolHistoryPruning } from "@/lib/ai/agents/chat-agent-history-pruning";

export const createAssistantAgent = (params: {
	model: LanguageModel;
	generationParams?: ChatAgentGenerationParams;
	telemetryIds: {
		organizationId: string;
		chatId: string;
		providerId: string;
		modelId: string;
	};
}) =>
	new ToolLoopAgent({
		model: params.model,
		...aiTelemetry("assistant.agent", params.telemetryIds),
		prepareCall: ({ options, ...settings }) => ({
			...applyToolHistoryPruning(settings, {
				displayToolNames: [],
				enabledDisplayToolNames: [],
			}),
			temperature: params.generationParams?.temperature,
			maxTokens: params.generationParams?.maxTokens,
			topP: params.generationParams?.topP,
			frequencyPenalty: params.generationParams?.frequencyPenalty,
			presencePenalty: params.generationParams?.presencePenalty,
			instructions: [
				{
					role: "system",
					content: buildAssistantSystemPrompt(),
				},
			],
		}),
		output: Output.text(),
	});
