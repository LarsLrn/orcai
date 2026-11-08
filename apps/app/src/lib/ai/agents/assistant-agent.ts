import {
	type AgentModel,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import type { ToolSet } from "ai";
import { pruneAssistantHistory } from "@/lib/ai/agents/assistant-history-pruning";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import {
	type AssistantUserContext,
	buildAssistantSystemPrompt,
} from "@/lib/ai/agents/assistant-system-prompt";
import {
	createToolLines,
	type StoredMessage,
} from "@/lib/ai/agents/assistant-tool-lines";
import {
	createTurnAgent,
	type ToolExecutions,
	type TurnTelemetryIds,
} from "@/lib/ai/agents/turn-agent";
import type { ChatSources } from "@/lib/ai/citations/chat-sources";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import {
	offeredAssistantToolNames,
	offeredToolGroups,
} from "@/lib/ai/tools/assistant/groups";
import type { Plan } from "@/lib/ai/tools/assistant/plan/plan";
import type { AssistantToolDeps } from "@/lib/ai/tools/assistant/procedure-tool";
import { buildAssistantTools } from "@/lib/ai/tools/assistant/toolset";
import { CONTENT_TOOL_NAMES } from "@/lib/ai/tools/registry";
import { NO_WEB_SEARCH } from "@/lib/ai/tools/web/toolset";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { DocsConfig } from "@/lib/effect/services/config";

/** The assistant's fixed features. */
export const ASSISTANT_FEATURES = {
	generativeUi: {},
	questions: {},
};

export const createAssistantAgent = (
	params: AssistantToolDeps & {
		model: AgentModel;
		callSettings: ChatCallSettings;
		compaction: ProviderCompaction;
		docs: DocsConfig | undefined;
		userContext: AssistantUserContext;
		/** The assistant's fixed features, resolved through the Feature catalog. */
		features: ResolvedFeature[];
		/** The stored conversation: its tool calls unlock tools and become summary lines. */
		history: readonly StoredMessage[];
		/** The conversation's current plan. */
		plan: Plan | undefined;
		/** The user's local date, from `localDate`. */
		today: string;
		/** The chat's sources, which the turn's calls add to. */
		sources: ChatSources;
		telemetryIds: TurnTelemetryIds;
		/** Applied before the session's guards wrap the tools. */
		toolExecutions?: ToolExecutions;
	},
) => {
	// The docs are the Assistant's only citable source.
	const citations = params.docs !== undefined;
	const featureTools: ToolSet = {};
	for (const { entry, settings } of params.features) {
		Object.assign(
			featureTools,
			entry.buildTools({
				context: params.context,
				settings,
				turn: {
					webSearch: NO_WEB_SEARCH,
					history: params.history,
					citations,
				},
			}),
		);
	}

	const session = createAssistantSession({
		history: params.history,
		capabilities: params.userContext.capabilities,
		toolLoading: params.model.toolLoading,
		compaction: params.compaction,
	});
	// Every tool, so stored calls validate with the docs or a feature off; activeTools narrows what the model sees.
	const built = buildAssistantTools({
		context: params.context,
		turn: params.turn,
		session,
		docs: params.docs,
		history: params.history,
	});
	const tools = session.declare(
		params.turn.calls.wrap(
			params.toolExecutions ? params.toolExecutions(built) : built,
		),
	);
	const toolGroups = offeredToolGroups(params.userContext.capabilities);
	const enabledContentToolNames = CONTENT_TOOL_NAMES.filter((name) =>
		Object.hasOwn(featureTools, name),
	);
	const disabled = new Set<string>([
		...CONTENT_TOOL_NAMES.filter(
			(name) => !enabledContentToolNames.includes(name),
		),
		...(params.docs === undefined
			? [
					"readDocs",
				]
			: []),
	]);
	const toolLines = createToolLines(params.history);

	return createTurnAgent({
		model: params.model,
		functionId: "assistant.agent",
		telemetryIds: params.telemetryIds,
		instructions: buildSystemInstructions(
			params.model.kind,
			buildAssistantSystemPrompt({
				docs: params.docs,
				userContext: params.userContext,
				featurePrompts: params.features.map(({ entry }) =>
					entry.prompt({
						citations,
					}),
				),
				toolGroups,
				plan: params.plan,
				today: params.today,
			}),
		),
		tools,
		activeTools: () =>
			session.activeTools().filter((name) => !disabled.has(name)),
		// Groups loaded during the turn send their tools too.
		offeredTools: (): ToolSet => {
			const offered = new Set<string>(
				offeredAssistantToolNames(params.userContext.capabilities),
			);

			return Object.fromEntries(
				Object.entries(tools).filter(
					([name]) => offered.has(name) && !disabled.has(name),
				),
			);
		},
		toolApproval: session.toolApproval,
		prune: (messages) =>
			pruneAssistantHistory(messages, {
				lines: toolLines.lines,
				contentToolNames: CONTENT_TOOL_NAMES,
				enabledContentToolNames,
				toolListChanges: session.toolListChanges,
			}),
		callSettings: params.callSettings,
		compaction: params.compaction,
		sources: params.sources,
		onToolResult: (result) => {
			toolLines.record([
				result,
			]);
			session.record(result);
		},
	});
};

export type AssistantTools = ReturnType<typeof buildAssistantTools>;
