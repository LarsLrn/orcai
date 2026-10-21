import {
	aiTelemetry,
	buildSystemInstructions,
	type ProviderCompaction,
} from "@orcai/ai";
import { isStepCount, Output, ToolLoopAgent, type ToolSet } from "ai";
import type { AgentModel } from "@/lib/ai/agents/agent-model";
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
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { offeredToolGroups } from "@/lib/ai/tools/assistant/groups";
import type { Plan } from "@/lib/ai/tools/assistant/plan/plan";
import type { AssistantToolDeps } from "@/lib/ai/tools/assistant/procedure-tool";
import { buildAssistantTools } from "@/lib/ai/tools/assistant/toolset";
import { toolNamesOf } from "@/lib/ai/tools/registry";
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
		}),
	);
	const toolGroups = offeredToolGroups(params.userContext.capabilities);
	const displayToolNames = toolNamesOf("display");
	const enabledDisplayToolNames = displayToolNames.filter((name) =>
		Object.hasOwn(featureTools, name),
	);
	const disabled = new Set<string>([
		...displayToolNames.filter(
			(name) => !enabledDisplayToolNames.includes(name),
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
				displayToolNames,
				enabledDisplayToolNames,
				toolListChanges: session.toolListChanges,
			}),
	});

	const instructions = buildSystemInstructions(
		params.model.kind,
		buildAssistantSystemPrompt({
			docs: params.docs,
			userContext: params.userContext,
			featurePrompts: params.features.map(({ entry }) => entry.prompt),
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
			const shapeStep = steps.prepareStep(options.maxSteps);
			return {
				...settings,
				...params.callSettings,
				providerOptions: params.compaction.providerOptions,
				instructions,
				stopWhen: isStepCount(options.maxSteps),
				prepareStep: (step) => ({
					...shapeStep(step),
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
			}
		},
		output: Output.text(),
	});

	return {
		agent,
		instructions,
	};
};
