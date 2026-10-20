import { aiTelemetry, buildSystemInstructions } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import type { DatabaseBlock } from "@orcai/schema";
import {
	isStepCount,
	type LanguageModel,
	Output,
	ToolLoopAgent,
	type ToolSet,
} from "ai";
import {
	buildGenUiTools,
	GEN_UI_TOOL_NAMES,
} from "@/components/chat/gen-ui/catalog";
import { applyToolHistoryPruning } from "@/lib/ai/agents/chat-agent-history-pruning";
import { buildChatAgentSystemPrompt } from "@/lib/ai/agents/chat-agent-system-prompt";
import {
	type ChatAgentTools,
	repairKnowledgeBaseToolCall,
} from "@/lib/ai/agents/repair-tool-call";
import {
	finalStepSettings,
	stepBudgetOptionsSchema,
} from "@/lib/ai/agents/step-budget";
import {
	stepFailures,
	withStoredToolFailures,
} from "@/lib/ai/agents/turn-history";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { buildKnowledgeBaseTools } from "@/lib/ai/tools/rag/toolset";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

export const createChatAgent = (params: {
	model: LanguageModel;
	providerKind: ProviderKind;
	systemPrompt: string;
	databaseBlocks: DatabaseBlock[];
	features: ResolvedFeature[];
	callSettings: ChatCallSettings;
	telemetryIds: {
		organizationId: string;
		chatId: string;
		providerId: string;
		modelId: string;
	};
	context: ORPCContext;
}) =>
	new ToolLoopAgent({
		model: params.model,
		// The typed tool set; prepareCall swaps in the tools offered this turn.
		tools: {
			...buildKnowledgeBaseTools({
				blocks: [],
				context: params.context,
			}),
			...buildGenUiTools(),
		} satisfies ChatAgentTools,
		...aiTelemetry("chat.agent", params.telemetryIds),
		experimental_repairToolCall: repairKnowledgeBaseToolCall,
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => {
			const hasKnowledgeBaseBlocks = params.databaseBlocks.length > 0;
			const tools: ToolSet = {
				...(hasKnowledgeBaseBlocks
					? buildKnowledgeBaseTools({
							blocks: params.databaseBlocks,
							context: params.context,
						})
					: {}),
			};
			for (const { entry, settings: featureSettings } of params.features) {
				Object.assign(
					tools,
					entry.buildTools({
						context: params.context,
						settings: featureSettings,
					}),
				);
			}
			const preparedSettings = applyToolHistoryPruning(settings, {
				displayToolNames: GEN_UI_TOOL_NAMES,
				enabledDisplayToolNames: GEN_UI_TOOL_NAMES.filter((name) =>
					Object.hasOwn(tools, name),
				),
			});
			const systemPrompt = buildChatAgentSystemPrompt({
				systemPrompt: params.systemPrompt,
				hasKnowledgeBaseBlocks,
				featurePrompts: params.features.map(({ entry }) => entry.prompt),
			});

			return {
				...preparedSettings,
				...params.callSettings,
				instructions: buildSystemInstructions(params.providerKind, {
					stable: systemPrompt,
				}),
				// A subset of the typed set; no tools at all when nothing is offered.
				tools:
					Object.keys(tools).length > 0 ? (tools as ChatAgentTools) : undefined,
				stopWhen: isStepCount(options.maxSteps),
				prepareStep: ({ stepNumber, messages, steps }) => {
					const sentMessages = withStoredToolFailures(
						messages,
						stepFailures(steps),
					);
					return {
						messages: sentMessages,
						...finalStepSettings({
							stepNumber,
							maxSteps: options.maxSteps,
							messages: sentMessages,
							providerKind: params.providerKind,
						}),
					};
				},
			};
		},
		output: Output.text(),
	});
