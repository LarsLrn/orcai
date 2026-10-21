import {
	aiTelemetry,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import type { DatabaseBlock } from "@orcai/schema";
import { Output, ToolLoopAgent, type ToolSet, type UIMessage } from "ai";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import type { AgentModel } from "@/lib/ai/agents/agent-model";
import { pruneChatHistory } from "@/lib/ai/agents/chat-agent-history-pruning";
import { buildChatAgentSystemPrompt } from "@/lib/ai/agents/chat-agent-system-prompt";
import {
	type ChatAgentTools,
	repairKnowledgeBaseToolCall,
} from "@/lib/ai/agents/repair-tool-call";
import { stepBudgetOptionsSchema } from "@/lib/ai/agents/step-budget";
import { createStepShaper } from "@/lib/ai/agents/step-request";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { buildKnowledgeBaseTools } from "@/lib/ai/tools/rag/toolset";
import { toolNamesOf } from "@/lib/ai/tools/registry";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

export const createChatAgent = (params: {
	model: AgentModel;
	systemPrompt: string;
	databaseBlocks: DatabaseBlock[];
	features: ResolvedFeature[];
	callSettings: ChatCallSettings;
	compaction: ProviderCompaction;
	telemetryIds: {
		organizationId: string;
		chatId: string;
		providerId: string;
		modelId: string;
	};
	context: ORPCContext;
	/** The stored messages the turn answers. */
	history: readonly UIMessage[];
}) => {
	const hasKnowledgeBaseBlocks = params.databaseBlocks.length > 0;
	const offeredTools: ToolSet = {
		...(hasKnowledgeBaseBlocks
			? buildKnowledgeBaseTools({
					blocks: params.databaseBlocks,
					context: params.context,
					history: params.history,
				})
			: {}),
	};
	for (const { entry, settings } of params.features) {
		Object.assign(
			offeredTools,
			entry.buildTools({
				context: params.context,
				settings,
			}),
		);
	}
	const displayToolNames = toolNamesOf("display");
	const steps = createStepShaper({
		providerKind: params.model.kind,
		prune: (messages) =>
			pruneChatHistory(messages, {
				displayToolNames,
				enabledDisplayToolNames: displayToolNames.filter((name) =>
					Object.hasOwn(offeredTools, name),
				),
			}),
	});

	const instructions = buildSystemInstructions(params.model.kind, {
		stable: buildChatAgentSystemPrompt({
			systemPrompt: params.systemPrompt,
			hasKnowledgeBaseBlocks,
			featurePrompts: params.features.map(({ entry }) => entry.prompt),
		}),
	});

	const agent = new ToolLoopAgent({
		model: params.model.language,
		// The typed tool set; prepareCall swaps in the tools offered this turn.
		tools: {
			...buildKnowledgeBaseTools({
				blocks: [],
				context: params.context,
				history: [],
			}),
			...buildGenUiTools(),
		} satisfies ChatAgentTools,
		...aiTelemetry("chat.agent", params.telemetryIds),
		experimental_repairToolCall: repairKnowledgeBaseToolCall,
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => ({
			...settings,
			...params.callSettings,
			providerOptions: params.compaction.providerOptions,
			instructions,
			// A subset of the typed set; no tools at all when nothing is offered.
			tools:
				Object.keys(offeredTools).length > 0
					? (offeredTools as ChatAgentTools)
					: undefined,
			...steps.forTurn(options),
		}),
		onToolExecutionEnd: ({ toolOutput }) => steps.recordExecution(toolOutput),
		output: Output.text(),
	});

	return {
		agent,
		instructions,
		contextFull: steps.contextFull,
	};
};
