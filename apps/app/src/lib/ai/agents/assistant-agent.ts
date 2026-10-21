import { aiTelemetry, buildSystemInstructions } from "@orcai/ai";
import { isStepCount, Output, ToolLoopAgent, type ToolSet } from "ai";
import {
	buildGenUiTools,
	GEN_UI_TOOL_NAMES,
} from "@/components/chat/gen-ui/catalog";
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
import {
	finalStepSettings,
	stepBudgetOptionsSchema,
} from "@/lib/ai/agents/step-budget";
import {
	stepFailures,
	type ToolFailure,
	withStoredToolFailures,
} from "@/lib/ai/agents/turn-history";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { offeredToolGroups } from "@/lib/ai/tools/assistant/groups";
import type { AssistantToolDeps } from "@/lib/ai/tools/assistant/procedure-tool";
import { buildAssistantTools } from "@/lib/ai/tools/assistant/toolset";
import { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { DocsConfig } from "@/lib/effect/services/config";

export const createAssistantAgent = (
	params: AssistantToolDeps & {
		model: AgentModel;
		callSettings: ChatCallSettings;
		docs: DocsConfig | undefined;
		userContext: AssistantUserContext;
		/** The assistant's fixed features, resolved through the Feature catalog. */
		features: ResolvedFeature[];
		/** The stored conversation: its tool calls unlock tools and become summary lines. */
		history: readonly StoredMessage[];
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
	});
	// The full set, so stored calls of any tool validate; activeTools narrows what the model sees.
	const tools = session.declare({
		// Stored readDocs parts keep validating when the docs are switched off.
		readDocs: readDocsTool({
			docs: params.docs,
		}),
		...buildGenUiTools(),
		...buildAssistantTools({
			context: params.context,
			turn: params.turn,
			session,
		}),
	});
	const toolGroups = offeredToolGroups(params.userContext.capabilities);
	const activeToolNames = () =>
		session
			.activeTools()
			.filter(
				(name) =>
					(name !== "readDocs" || params.docs !== undefined) &&
					(!GEN_UI_TOOL_NAMES.some((display) => display === name) ||
						Object.hasOwn(featureTools, name)),
			);

	const enabledDisplayToolNames = GEN_UI_TOOL_NAMES.filter((name) =>
		Object.hasOwn(featureTools, name),
	);
	const toolLines = createToolLines(params.history);
	// Calls approved in an earlier request fail before the first step, outside every step's content.
	const executionFailures: ToolFailure[] = [];

	return new ToolLoopAgent({
		model: params.model.language,
		tools,
		toolApproval: session.toolApproval,
		...aiTelemetry("assistant.agent", params.telemetryIds),
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => ({
			...settings,
			...params.callSettings,
			instructions: buildSystemInstructions(
				params.model.kind,
				buildAssistantSystemPrompt({
					docs: params.docs,
					userContext: params.userContext,
					featurePrompts: params.features.map(({ entry }) => entry.prompt),
					toolGroups,
				}),
			),
			stopWhen: isStepCount(options.maxSteps),
			prepareStep: ({ stepNumber, messages, steps }) => {
				const sentMessages = withStoredToolFailures(messages, [
					...executionFailures,
					...stepFailures(steps),
				]);
				const prunedMessages = pruneAssistantHistory(sentMessages, {
					lines: toolLines.lines,
					displayToolNames: GEN_UI_TOOL_NAMES,
					enabledDisplayToolNames,
					toolListChanges: session.toolListChanges,
				});
				return {
					messages: prunedMessages,
					activeTools: activeToolNames(),
					...finalStepSettings({
						stepNumber,
						maxSteps: options.maxSteps,
						messages: prunedMessages,
						providerKind: params.model.kind,
					}),
				};
			},
		}),
		// Also sees tools approved in an earlier request, which run before the first step.
		onToolExecutionEnd: ({ toolOutput }) => {
			if (toolOutput.type === "tool-error") {
				executionFailures.push(toolOutput);
			}
			if (toolOutput.type === "tool-result") {
				toolLines.record([
					toolOutput,
				]);
				session.record(toolOutput);
			}
		},
		output: Output.text(),
	});
};
