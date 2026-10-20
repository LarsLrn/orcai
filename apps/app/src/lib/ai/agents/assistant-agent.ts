import {
	aiTelemetry,
	buildSystemInstructions,
	type ToolLoading,
} from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
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
import { pruneAssistantHistory } from "@/lib/ai/agents/assistant-history-pruning";
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
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import { assistantToolApproval } from "@/lib/ai/tools/assistant/approval";
import { groupsLoadedBy } from "@/lib/ai/tools/assistant/core/load-tools";
import {
	activeAssistantToolNames,
	DEFERRED_TOOL_NAMES,
	type DeferredToolGroup,
	offeredAssistantToolNames,
	offeredToolGroups,
} from "@/lib/ai/tools/assistant/groups";
import type { AssistantToolDeps } from "@/lib/ai/tools/assistant/procedure-tool";
import { buildAssistantTools } from "@/lib/ai/tools/assistant/toolset";
import { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { ChatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import type { DocsConfig } from "@/lib/effect/services/config";

/** Where tools load through references, the deferred groups' tools are declared deferred. */
const deferGroupTools = <T extends ToolSet>(
	tools: T,
	toolLoading: ToolLoading,
): T =>
	toolLoading.type === "references"
		? (Object.fromEntries(
				Object.entries(tools).map(([name, tool]) => [
					name,
					DEFERRED_TOOL_NAMES.has(name)
						? {
								...tool,
								providerOptions: {
									...tool.providerOptions,
									...toolLoading.deferredToolOptions,
								},
							}
						: tool,
				]),
			) as T)
		: tools;

export const createAssistantAgent = (
	params: AssistantToolDeps & {
		model: LanguageModel;
		providerKind: ProviderKind;
		toolLoading: ToolLoading;
		callSettings: ChatCallSettings;
		docs: DocsConfig | undefined;
		userContext: AssistantUserContext;
		/** The assistant's fixed features, resolved through the Feature catalog. */
		features: ResolvedFeature[];
		/** Whether the stored conversation holds an approved plan. */
		planApproved: boolean;
		/** The groups the conversation's stored `loadTools` calls loaded. */
		loadedToolGroups: readonly DeferredToolGroup[];
		/** The stored conversation, whose tool outputs become summary lines. */
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

	// Approval holds for the conversation; a plan approved in an earlier request runs before the first step.
	let planApproved = params.planApproved;
	// Loaded groups stay loaded for the conversation, including this generation's loads.
	const loadedGroups = new Set(params.loadedToolGroups);

	// The full set, so stored calls of any tool validate; activeTools narrows what the model sees.
	const tools = deferGroupTools(
		{
			// Stored readDocs parts keep validating when the docs are switched off.
			readDocs: readDocsTool({
				docs: params.docs,
			}),
			...buildGenUiTools(),
			...buildAssistantTools({
				context: params.context,
				turn: params.turn,
				capabilities: params.userContext.capabilities,
				isPlanApproved: () => planApproved,
				loadedGroups: () => [
					...loadedGroups,
				],
				toolLoading: params.toolLoading,
			}),
		},
		params.toolLoading,
	);

	const toolGroups = offeredToolGroups(params.userContext.capabilities);
	// Deferred tools are all declared from the start, so loading and approving leave the list as it is.
	const activeToolNames = () =>
		(params.toolLoading.type === "references"
			? offeredAssistantToolNames(params.userContext.capabilities)
			: activeAssistantToolNames(
					params.userContext.capabilities,
					[
						...loadedGroups,
					],
					planApproved,
				)
		).filter(
			(name) =>
				(name !== "readDocs" || params.docs !== undefined) &&
				(!GEN_UI_TOOL_NAMES.some((display) => display === name) ||
					Object.hasOwn(featureTools, name)),
		);

	const enabledDisplayToolNames = GEN_UI_TOOL_NAMES.filter((name) =>
		Object.hasOwn(featureTools, name),
	);
	const toolLines = createToolLines(params.history);

	return new ToolLoopAgent({
		model: params.model,
		tools,
		toolApproval: assistantToolApproval({
			isPlanApproved: () => planApproved,
		}),
		...aiTelemetry("assistant.agent", params.telemetryIds),
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => ({
			...settings,
			...params.callSettings,
			instructions: buildSystemInstructions(
				params.providerKind,
				buildAssistantSystemPrompt({
					docs: params.docs,
					userContext: params.userContext,
					featurePrompts: params.features.map(({ entry }) => entry.prompt),
					toolGroups,
				}),
			),
			stopWhen: isStepCount(options.maxSteps),
			prepareStep: ({ stepNumber, messages }) => {
				const prunedMessages = pruneAssistantHistory(messages, {
					lines: toolLines.lines,
					displayToolNames: GEN_UI_TOOL_NAMES,
					enabledDisplayToolNames,
					toolListChanges: params.toolLoading.type === "active-tools",
				});
				return {
					messages: prunedMessages,
					activeTools: activeToolNames(),
					...finalStepSettings({
						stepNumber,
						maxSteps: options.maxSteps,
						messages: prunedMessages,
						providerKind: params.providerKind,
					}),
				};
			},
		}),
		// Also sees tools approved in an earlier request, which run before the first step.
		onToolExecutionEnd: ({ toolOutput }) => {
			if (toolOutput.type === "tool-result") {
				toolLines.record([
					toolOutput,
				]);
				// Before approval every updatePlan call is gated, so one that ran was approved.
				if (toolOutput.toolName === "updatePlan") {
					planApproved = true;
				}
				if (toolOutput.toolName === "loadTools") {
					for (const group of groupsLoadedBy(toolOutput.output)) {
						loadedGroups.add(group);
					}
				}
			}
		},
		output: Output.text(),
	});
};
