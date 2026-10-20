import { z } from "zod/v4";
import {
	type AssistantToolName,
	type CapabilitySet,
	DEFERRED_TOOL_GROUPS,
	type DeferredToolGroup,
	offeredGroupTools,
	offeredToolGroups,
} from "../groups";
import { assistantTool } from "../procedure-tool";

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
	  }
	| {
			group: DeferredToolGroup;
			loaded: false;
			error: string;
	  };

/** Loading is idempotent: the agent derives the loaded groups from these results. */
export const loadToolsTool = (capabilities: CapabilitySet) =>
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
							? {
									group,
									loaded: true,
									tools: offeredGroupTools(group, capabilities),
								}
							: {
									group,
									loaded: false,
									error: "FORBIDDEN: This user may not use these tools.",
								},
				),
			};
		},
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
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
