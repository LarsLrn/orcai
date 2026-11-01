import type { AgentModel } from "@orcai/ai";
import {
	aiTelemetry,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import type { DatabaseBlock } from "@orcai/schema";
import { Output, ToolLoopAgent, type ToolSet, type UIMessage } from "ai";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import { pruneChatHistory } from "@/lib/ai/agents/chat-agent-history-pruning";
import { buildChatAgentSystemPrompt } from "@/lib/ai/agents/chat-agent-system-prompt";
import {
	type ChatAgentTools,
	repairRepositoryToolCall,
} from "@/lib/ai/agents/repair-tool-call";
import { stepBudgetOptionsSchema } from "@/lib/ai/agents/step-budget";
import { createStepShaper } from "@/lib/ai/agents/step-request";
import type { ChatSources } from "@/lib/ai/citations/chat-sources";
import type { CitableKind } from "@/lib/ai/citations/citation-rules";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { buildQuestionTools } from "@/lib/ai/tools/questions/toolset";
import { buildRepositoryTools } from "@/lib/ai/tools/rag/toolset";
import { CONTENT_TOOL_NAMES } from "@/lib/ai/tools/registry";
import {
	storedWebSearchTools,
	type TurnWebSearch,
} from "@/lib/ai/tools/web/toolset";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

export const createChatAgent = (params: {
	model: AgentModel;
	systemPrompt: string | undefined;
	/** The user's local date, from `localDate`. */
	today: string;
	databaseBlocks: DatabaseBlock[];
	features: ResolvedFeature[];
	webSearch: TurnWebSearch;
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
	/** The chat's sources, which the turn's calls add to. */
	sources: ChatSources;
}) => {
	const hasRepositories = params.databaseBlocks.length > 0;
	// Native search issues no refs, so only the search provider's results are citable.
	const searchesWeb =
		params.webSearch.kind === "provider" &&
		params.features.some(({ id }) => id === "webSearch");
	const citable: CitableKind[] = [
		...(hasRepositories
			? ([
					"passage",
				] as const)
			: []),
		...(searchesWeb
			? ([
					"web",
				] as const)
			: []),
	];
	const citations = citable.length > 0;
	const offeredTools: ToolSet = {
		...(hasRepositories
			? buildRepositoryTools({
					blocks: params.databaseBlocks,
					context: params.context,
					sources: params.sources,
				})
			: {}),
	};
	for (const { entry, settings } of params.features) {
		Object.assign(
			offeredTools,
			entry.buildTools({
				context: params.context,
				settings,
				turn: {
					webSearch: params.webSearch,
					history: params.history,
					citations,
				},
			}),
		);
	}
	const steps = createStepShaper({
		providerKind: params.model.kind,
		prune: (messages) =>
			pruneChatHistory(messages, {
				contentToolNames: CONTENT_TOOL_NAMES,
				enabledContentToolNames: CONTENT_TOOL_NAMES.filter((name) =>
					Object.hasOwn(offeredTools, name),
				),
			}),
	});

	const instructions = buildSystemInstructions(
		params.model.kind,
		buildChatAgentSystemPrompt({
			behaviour: params.systemPrompt,
			repositories: params.databaseBlocks,
			featurePrompts: params.features.map(({ entry }) =>
				entry.prompt({
					citations,
				}),
			),
			citable,
			today: params.today,
		}),
	);

	const agent = new ToolLoopAgent({
		model: params.model.language,
		// The typed tool set; prepareCall swaps in the tools offered this turn.
		tools: {
			...buildRepositoryTools({
				blocks: [],
				context: params.context,
				sources: params.sources,
			}),
			...buildGenUiTools({
				citations,
			}),
			...buildQuestionTools({
				history: [],
			}),
			...storedWebSearchTools(),
		} satisfies ChatAgentTools,
		...aiTelemetry("chat.agent", params.telemetryIds),
		experimental_repairToolCall: repairRepositoryToolCall,
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
		onToolExecutionEnd: ({ toolOutput }) => {
			steps.recordExecution(toolOutput);
			if (toolOutput.type === "tool-result") {
				params.sources.record(toolOutput.toolName, toolOutput.output);
			}
		},
		output: Output.text(),
	});

	return {
		agent,
		instructions,
		offeredTools: () => offeredTools,
		contextFull: steps.contextFull,
	};
};
