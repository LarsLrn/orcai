import type { ToolLoading } from "@orcai/ai";
import { z } from "zod/v4";
import {
	ASSISTANT_TOOL_KINDS,
	type AssistantToolName,
	type CapabilitySet,
	DEFERRED_TOOL_GROUPS,
	type DeferredToolGroup,
	offeredGroupTools,
	offeredToolGroups,
} from "../groups";
import { assistantTool } from "../procedure-tool";
import { toolLoadingOutput } from "../tool-references";

export const loadToolsInputSchema = z.object({
	groups: z
		.array(z.enum(DEFERRED_TOOL_GROUPS))
		.min(1)
		.describe("Every tool group this request needs, in one call."),
});

export type LoadToolsGroupResult =
	| {
			group: DeferredToolGroup;
			loaded: true;
			tools: AssistantToolName[];
			/** Offered tools that stay hidden until the user approved a plan. */
			lockedUntilPlanApproved?: AssistantToolName[];
	  }
	| {
			group: DeferredToolGroup;
			loaded: false;
			error: string;
	  };

const loadedGroup = (
	group: DeferredToolGroup,
	tools: AssistantToolName[],
	planApproved: boolean,
): LoadToolsGroupResult => {
	const locked = planApproved
		? []
		: tools.filter((name) => ASSISTANT_TOOL_KINDS[name] === "create");

	return {
		group,
		loaded: true,
		tools: tools.filter((name) => !locked.includes(name)),
		...(locked.length > 0
			? {
					lockedUntilPlanApproved: locked,
				}
			: {}),
	};
};

/** Loading is idempotent: the agent derives the loaded groups from these results. */
export const loadToolsTool = ({
	capabilities,
	isPlanApproved,
	toolLoading,
}: {
	capabilities: CapabilitySet;
	isPlanApproved: () => boolean;
	toolLoading: ToolLoading;
}) =>
	assistantTool({
		description:
			"Load tool groups for the rest of this conversation. Their tools are callable from your next step. Loading a group that is already loaded changes nothing.",
		inputSchema: loadToolsInputSchema,
		execute: ({ groups }) => {
			const offered = offeredToolGroups(capabilities);

			return {
				groups: [
					...new Set(groups),
				].map(
					(group): LoadToolsGroupResult =>
						offered.includes(group)
							? loadedGroup(
									group,
									offeredGroupTools(group, capabilities),
									isPlanApproved(),
								)
							: {
									group,
									loaded: false,
									error: "FORBIDDEN: This user may not use these tools.",
								},
				),
			};
		},
		// The group's tools as this user may use them now; create tools only when the result made them callable.
		toModelOutput: ({ output }) =>
			toolLoadingOutput(
				output,
				output.groups.flatMap((result) =>
					result.loaded
						? offeredGroupTools(result.group, capabilities).filter(
								(name) =>
									ASSISTANT_TOOL_KINDS[name] !== "create" ||
									result.tools.includes(name),
							)
						: [],
				),
				{
					toolLoading,
					capabilities,
				},
			),
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** The groups a stored or fresh `loadTools` output loaded. */
export const groupsLoadedBy = (output: unknown): DeferredToolGroup[] =>
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

/** The groups the conversation's successful `loadTools` calls loaded. */
export const loadedToolGroupsOf = (
	messages: readonly {
		role: string;
		parts: readonly unknown[];
	}[],
): DeferredToolGroup[] => {
	const outputs = messages
		.filter((message) => message.role === "assistant")
		.flatMap((message) => message.parts)
		.filter(
			(part) =>
				isRecord(part) &&
				part.type === "tool-loadTools" &&
				part.state === "output-available",
		)
		.map((part) => (part as Record<string, unknown>).output);

	return DEFERRED_TOOL_GROUPS.filter((group) =>
		outputs.some((output) => groupsLoadedBy(output).includes(group)),
	);
};
