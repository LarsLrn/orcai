import { type LanguageModel, Output, stepCountIs, ToolLoopAgent } from "ai";
import { applyToolHistoryPruning } from "@/lib/ai/agents/chat-agent-history-pruning";
import { buildChatAgentSystemPrompt } from "@/lib/ai/agents/chat-agent-system-prompt";
import { repairKnowledgeBaseToolCall } from "@/lib/ai/agents/repair-tool-call";
import { buildKnowledgeBaseTools } from "@/lib/ai/tools/rag/toolset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

const chatAgentToolSet = buildKnowledgeBaseTools({
	blocks: [], // Placeholder, will be set in prepareCall
});

export interface ChatAgentGenerationParams {
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

export const createChatAgent = (params: {
	model: LanguageModel;
	systemPrompt: string;
	databaseBlocks: DatabaseBlock[];
	generationParams?: ChatAgentGenerationParams;
}) =>
	new ToolLoopAgent({
		model: params.model,
		tools: chatAgentToolSet,
		experimental_repairToolCall: repairKnowledgeBaseToolCall,
		prepareCall: ({ options, ...settings }) => {
			const preparedSettings = applyToolHistoryPruning(settings);
			const hasKnowledgeBaseBlocks = params.databaseBlocks.length > 0;
			const tools = hasKnowledgeBaseBlocks
				? buildKnowledgeBaseTools({
						blocks: params.databaseBlocks,
					})
				: undefined;
			const systemPrompt = buildChatAgentSystemPrompt({
				systemPrompt: params.systemPrompt,
				hasKnowledgeBaseBlocks,
			});

			return {
				...preparedSettings,
				temperature: params.generationParams?.temperature,
				maxTokens: params.generationParams?.maxTokens,
				topP: params.generationParams?.topP,
				frequencyPenalty: params.generationParams?.frequencyPenalty,
				presencePenalty: params.generationParams?.presencePenalty,
				instructions: [
					{
						role: "system",
						content: systemPrompt,
					},
				],
				tools: tools,
				stopWhen: stepCountIs(10),
			};
		},
		output: Output.text(),
	});
