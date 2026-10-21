import type { ProviderCompaction, ToolLoading } from "@orcai/ai";
import { compactionPoint } from "@orcai/core";
import type { JSONValue, ToolResultPart, ToolSet } from "ai";
import {
	type StoredMessage,
	storedExecutions,
	type ToolExecution,
} from "@/lib/ai/agents/assistant-tool-lines";
import {
	type AssistantToolName,
	type CapabilitySet,
	CONFIRMED_TOOLS,
	DEFERRED_TOOL_GROUPS,
	DEFERRED_TOOL_NAMES,
	type DeferredToolGroup,
	isCreateTool,
	isToolOffered,
	offeredAssistantToolNames,
	offeredGroupTools,
} from "@/lib/ai/tools/assistant/groups";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";

interface SessionState {
	planApproved: boolean;
	loadedGroups: ReadonlySet<DeferredToolGroup>;
}

/** How a provider makes loaded tools callable. */
interface LoadingAdapter {
	declare: <T extends ToolSet>(tools: T) => T;
	activeTools: (state: SessionState) => AssistantToolName[];
	/** The model output of a result that makes `tools` callable. */
	modelOutput: (
		output: JSONValue,
		tools: readonly string[],
	) => ToolResultPart["output"];
}

const loadedGroupTools = (
	capabilities: CapabilitySet,
	loadedGroups: ReadonlySet<DeferredToolGroup>,
) =>
	DEFERRED_TOOL_GROUPS.filter((group) => loadedGroups.has(group)).flatMap(
		(group) => offeredGroupTools(group, capabilities),
	);

/** Only the core and loaded tools are sent; create tools once the user approved a plan. */
const activeToolsAdapter = (capabilities: CapabilitySet): LoadingAdapter => ({
	declare: (tools) => tools,
	activeTools: ({ planApproved, loadedGroups }) =>
		[
			...offeredGroupTools("core", capabilities),
			...loadedGroupTools(capabilities, loadedGroups),
		].filter((name) => planApproved || !isCreateTool(name)),
	modelOutput: (output) => ({
		type: "json",
		value: output,
	}),
});

/**
 * Every offered tool is declared from the start, the group tools deferred;
 * results reference the tools they make callable, which loads them. Stored
 * outputs replay with the lists of their time. The references before a
 * compaction no longer load anything, so the tools they loaded are declared
 * loaded.
 */
const referencesAdapter = (
	capabilities: CapabilitySet,
	loading: Extract<
		ToolLoading,
		{
			type: "references";
		}
	>,
	compacted: ReadonlySet<string>,
): LoadingAdapter => ({
	declare: <T extends ToolSet>(tools: T) =>
		Object.fromEntries(
			Object.entries(tools).map(([name, tool]) => [
				name,
				DEFERRED_TOOL_NAMES.has(name) && !compacted.has(name)
					? {
							...tool,
							providerOptions: {
								...tool.providerOptions,
								...loading.deferredToolOptions,
							},
						}
					: tool,
			]),
		) as T,
	activeTools: () => offeredAssistantToolNames(capabilities),
	modelOutput: (output, tools) => {
		const referenced = tools.filter((name) =>
			isToolOffered(name, capabilities),
		);

		return referenced.length > 0
			? {
					type: "content",
					value: [
						{
							type: "text",
							text: JSON.stringify(output),
						},
						...referenced.map(loading.reference),
					],
				}
			: {
					type: "json",
					value: output,
				};
	},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** The groups a `loadTools` output loaded. */
const groupsLoadedBy = (output: unknown): DeferredToolGroup[] =>
	isRecord(output) && Array.isArray(output.groups)
		? DEFERRED_TOOL_GROUPS.filter((group) =>
				(output.groups as unknown[]).some(
					(result) =>
						isRecord(result) &&
						result.group === group &&
						result.loaded === true,
				),
			)
		: [];

/** Gates create tools on an approved plan where the request may declare them before. */
const guardCreateTools = <T extends ToolSet>(
	tools: T,
	isPlanApproved: () => boolean,
): T =>
	Object.fromEntries(
		Object.entries(tools).map(([name, tool]) => {
			const { execute } = tool;

			return [
				name,
				isCreateTool(name) && execute
					? {
							...tool,
							execute: (input, options) => {
								if (!isPlanApproved()) {
									throw new AssistantToolError(
										"PLAN_NOT_APPROVED: Creating needs a plan the user approved. Propose one with updatePlan first.",
									);
								}
								return execute(input, options);
							},
						}
					: tool,
			];
		}),
	) as T;

export interface AssistantSession {
	capabilities: CapabilitySet;
	isPlanApproved: () => boolean;
	/** Records a tool call that ran, from the stored conversation or this request. */
	record: (
		execution: Pick<ToolExecution, "toolCallId" | "toolName" | "output">,
	) => void;
	/** The tools as the request declares them, every one, so stored calls of any tool validate. */
	declare: <T extends ToolSet>(tools: T) => T;
	/** The tools the model may call in the next step. */
	activeTools: () => AssistantToolName[];
	/** The calls whose results changed the active tools. */
	toolListChanges: ReadonlySet<string>;
	/** The create tools approving the plan now would unlock; none once a plan is approved. */
	unlockedByApproval: () => AssistantToolName[];
	/** The model output of a result that makes `tools` callable. */
	modelOutput: LoadingAdapter["modelOutput"];
	/**
	 * The confirmed tools always pause; `updatePlan` pauses until the user
	 * approved a plan, read as each call comes up.
	 */
	toolApproval: Record<
		string,
		"user-approval" | (() => "user-approval" | "not-applicable")
	> & {
		updatePlan: () => "user-approval" | "not-applicable";
	};
}

/**
 * What an assistant conversation has unlocked: whether the user approved a
 * plan and which tool groups are loaded, read from the stored conversation
 * and kept current by recording each tool call that ran. It answers which
 * tools the request declares and which are active, which calls changed that
 * list, and gates the create tools and `updatePlan` on approval.
 */
export const createAssistantSession = ({
	history,
	capabilities,
	toolLoading,
	compaction,
}: {
	history: readonly StoredMessage[];
	capabilities: CapabilitySet;
	toolLoading: ToolLoading;
	compaction: Pick<ProviderCompaction, "reads">;
}): AssistantSession => {
	const point = compactionPoint(history, compaction.reads);
	const compacted = point
		? storedExecutions([
				...history.slice(0, point.message),
				{
					parts: history[point.message].parts.slice(0, point.part),
				},
			]).flatMap(({ toolName, output }) =>
				toolName === "loadTools"
					? loadedGroupTools(capabilities, new Set(groupsLoadedBy(output)))
					: [],
			)
		: [];
	const adapter =
		toolLoading.type === "references"
			? referencesAdapter(capabilities, toolLoading, new Set(compacted))
			: activeToolsAdapter(capabilities);
	const loadedGroups = new Set<DeferredToolGroup>();
	const state = {
		planApproved: false,
		loadedGroups,
	};
	const toolListChanges = new Set<string>();
	const isPlanApproved = () => state.planApproved;

	const record: AssistantSession["record"] = (execution) => {
		const before = adapter.activeTools(state);
		// updatePlan runs only once approved: the first call waits for the user.
		if (execution.toolName === "updatePlan") {
			state.planApproved = true;
		}
		if (execution.toolName === "loadTools") {
			for (const group of groupsLoadedBy(execution.output)) {
				loadedGroups.add(group);
			}
		}
		const after = adapter.activeTools(state);
		if (
			before.length !== after.length ||
			before.some((name, index) => name !== after[index])
		) {
			toolListChanges.add(execution.toolCallId);
		}
	};

	for (const execution of storedExecutions(history)) {
		record(execution);
	}

	return {
		capabilities,
		isPlanApproved,
		record,
		declare: (tools) =>
			guardCreateTools(adapter.declare(tools), isPlanApproved),
		activeTools: () => adapter.activeTools(state),
		toolListChanges,
		unlockedByApproval: () =>
			state.planApproved
				? []
				: loadedGroupTools(capabilities, loadedGroups).filter(isCreateTool),
		modelOutput: adapter.modelOutput,
		toolApproval: {
			...Object.fromEntries(
				[
					...CONFIRMED_TOOLS.keys(),
				].map((name) => [
					name,
					"user-approval" as const,
				]),
			),
			updatePlan: () =>
				state.planApproved ? "not-applicable" : "user-approval",
		},
	};
};
