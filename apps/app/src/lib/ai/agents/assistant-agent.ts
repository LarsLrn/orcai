import type { AgentModel } from "@orcai/ai";
import {
	aiTelemetry,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import { Output, ToolLoopAgent, type ToolSet } from "ai";
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
import { stepBudgetOptionsSchema } from "@/lib/ai/agents/step-budget";
import { createStepShaper } from "@/lib/ai/agents/step-request";
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
		/** The chat's sources, which the turn's calls add to. */
		sources: ChatSources;
		telemetryIds: {
			organizationId: string;
			chatId: string;
			providerId: string;
			modelId: string;
		};
	},
) => {
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
					citations: false,
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
	const tools = session.declare(
		buildAssistantTools({
			context: params.context,
			turn: params.turn,
			session,
			docs: params.docs,
			history: params.history,
		}),
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
	const activeToolNames = () =>
		session.activeTools().filter((name) => !disabled.has(name));

	const toolLines = createToolLines(params.history);
	const steps = createStepShaper({
		providerKind: params.model.kind,
		prune: (messages) =>
			pruneAssistantHistory(messages, {
				lines: toolLines.lines,
				contentToolNames: CONTENT_TOOL_NAMES,
				enabledContentToolNames,
				toolListChanges: session.toolListChanges,
			}),
	});

	const instructions = buildSystemInstructions(
		params.model.kind,
		buildAssistantSystemPrompt({
			docs: params.docs,
			userContext: params.userContext,
			featurePrompts: params.features.map(({ entry }) =>
				entry.prompt({
					citations: false,
				}),
			),
			toolGroups,
			plan: params.plan,
		}),
	);

	const agent = new ToolLoopAgent({
		model: params.model.language,
		tools,
		toolApproval: session.toolApproval,
		...aiTelemetry("assistant.agent", params.telemetryIds),
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => {
			const turn = steps.forTurn(options);
			return {
				...settings,
				...params.callSettings,
				providerOptions: params.compaction.providerOptions,
				instructions,
				stopWhen: turn.stopWhen,
				prepareStep: (step) => ({
					...turn.prepareStep(step),
					activeTools: activeToolNames(),
				}),
			};
		},
		// Also sees tools approved in an earlier request, which run before the first step.
		onToolExecutionEnd: ({ toolOutput }) => {
			steps.recordExecution(toolOutput);
			if (toolOutput.type === "tool-result") {
				toolLines.record([
					toolOutput,
				]);
				session.record(toolOutput);
				params.sources.record(toolOutput.toolName, toolOutput.output);
			}
		},
		output: Output.text(),
	});

	return {
		agent,
		instructions,
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
		contextFull: steps.contextFull,
	};
};
