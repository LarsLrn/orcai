import {
	type AgentModel,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import type { Repository } from "@orcai/schema";
import type { ToolSet, UIMessage } from "ai";
import { pruneChatHistory } from "@/lib/ai/agents/chat-agent-history-pruning";
import { buildChatAgentSystemPrompt } from "@/lib/ai/agents/chat-agent-system-prompt";
import {
	createTurnAgent,
	type TurnTelemetryIds,
} from "@/lib/ai/agents/turn-agent";
import type { ChatSources } from "@/lib/ai/citations/chat-sources";
import type { CitableKind } from "@/lib/ai/citations/citation-rules";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { buildGenUiTools } from "@/lib/ai/tools/gen-ui/catalog";
import { buildQuestionTools } from "@/lib/ai/tools/questions/toolset";
import { buildRepositoryTools } from "@/lib/ai/tools/rag/toolset";
import { CONTENT_TOOL_NAMES } from "@/lib/ai/tools/registry";
import {
	storedWebSearchTools,
	type TurnWebSearch,
} from "@/lib/ai/tools/web/toolset";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

/** Every tool a plain or bot chat's stored calls may name. */
const chatTools = ({
	repositoryTools,
	citations,
	history,
}: {
	repositoryTools: ReturnType<typeof buildRepositoryTools>;
	citations: boolean;
	history: readonly UIMessage[];
}) => ({
	...repositoryTools,
	...buildGenUiTools({
		citations,
	}),
	...buildQuestionTools({
		history,
	}),
	// Search runs only where the turn offers it; these read stored calls.
	...storedWebSearchTools(),
});

export type ChatTools = ReturnType<typeof chatTools>;

export const createChatAgent = (params: {
	model: AgentModel;
	systemPrompt: string | undefined;
	/** The user's local date, from `localDate`. */
	today: string;
	repositories: Repository[];
	features: ResolvedFeature[];
	webSearch: TurnWebSearch;
	callSettings: ChatCallSettings;
	compaction: ProviderCompaction;
	telemetryIds: TurnTelemetryIds;
	context: ORPCContext;
	/** The stored messages the turn answers. */
	history: readonly UIMessage[];
	/** Whether a user message of the chat has an attachment. */
	hasAttachments: boolean;
	/** The chat's sources, which the turn's calls add to. */
	sources: ChatSources;
}) => {
	const hasRepositories = params.repositories.length > 0;
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
		...(params.hasAttachments
			? ([
					"attachment",
				] as const)
			: []),
	];
	const citations = citable.length > 0;
	const repositoryTools = buildRepositoryTools({
		blocks: params.repositories,
		context: params.context,
		sources: params.sources,
	});
	const allTools = chatTools({
		repositoryTools,
		citations,
		history: params.history,
	});
	const offeredTools: ToolSet = hasRepositories
		? {
				...repositoryTools,
			}
		: {};
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
	const offeredNames = Object.keys(offeredTools);

	return createTurnAgent({
		model: params.model,
		functionId: "chat.agent",
		telemetryIds: params.telemetryIds,
		instructions: buildSystemInstructions(
			params.model.kind,
			buildChatAgentSystemPrompt({
				behaviour: params.systemPrompt,
				repositories: params.repositories,
				featurePrompts: params.features.map(({ entry }) =>
					entry.prompt({
						citations,
					}),
				),
				citable,
				today: params.today,
			}),
		),
		// The offered tools first, in the order they were offered, so requests send them so.
		tools: {
			...offeredTools,
			...Object.fromEntries(
				Object.entries(allTools).filter(
					([name]) => !Object.hasOwn(offeredTools, name),
				),
			),
		},
		activeTools: () => offeredNames,
		offeredTools: () => offeredTools,
		prune: (messages) =>
			pruneChatHistory(messages, {
				contentToolNames: CONTENT_TOOL_NAMES,
				enabledContentToolNames: CONTENT_TOOL_NAMES.filter((name) =>
					Object.hasOwn(offeredTools, name),
				),
			}),
		callSettings: params.callSettings,
		compaction: params.compaction,
		sources: params.sources,
	});
};
