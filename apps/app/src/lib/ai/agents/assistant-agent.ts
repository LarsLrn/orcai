import { aiTelemetry } from "@orcai/ai";
import { type LanguageModel, Output, ToolLoopAgent } from "ai";
import {
	type AssistantUserContext,
	buildAssistantSystemPrompt,
} from "@/lib/ai/agents/assistant-system-prompt";
import type { ChatAgentGenerationParams } from "@/lib/ai/agents/chat-agent";
import { applyToolHistoryPruning } from "@/lib/ai/agents/chat-agent-history-pruning";
import { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { DocsConfig } from "@/lib/effect/services/config";

export const createAssistantAgent = (params: {
	model: LanguageModel;
	generationParams?: ChatAgentGenerationParams;
	docs: DocsConfig | undefined;
	userContext: AssistantUserContext;
	telemetryIds: {
		organizationId: string;
		chatId: string;
		providerId: string;
		modelId: string;
	};
}) => {
	// Stored readDocs parts keep validating when the docs are switched off.
	const tools = {
		readDocs: readDocsTool({
			docs: params.docs,
		}),
	};

	return new ToolLoopAgent({
		model: params.model,
		tools,
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
					content: buildAssistantSystemPrompt({
						docs: params.docs,
						userContext: params.userContext,
					}),
				},
			],
			tools: params.docs ? tools : undefined,
		}),
		output: Output.text(),
	});
};
