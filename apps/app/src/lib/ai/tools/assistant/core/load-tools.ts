import { z } from "zod/v4";
import type { AssistantSession } from "@/lib/ai/agents/assistant-session";
import {
	type AssistantToolName,
	DEFERRED_TOOL_GROUPS,
	type DeferredToolGroup,
	isCreateTool,
	offeredGroupTools,
	offeredToolGroups,
} from "../groups";
import { type AssistantTool, assistantTool } from "../procedure-tool";

export const loadToolsInputSchema = z.strictObject({
	groups: z
		.array(z.enum(DEFERRED_TOOL_GROUPS))
		.min(1)
		.describe("Every tool group this request needs, in one call."),
});

type LoadToolsGroupResult =
	| {
			group: DeferredToolGroup;
			loaded: true;
			tools: string[];
			/** Offered tools that stay hidden until the user approved a plan. */
			lockedUntilPlanApproved?: string[];
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
	const locked = planApproved ? [] : tools.filter(isCreateTool);

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

/** Loading is idempotent: the session derives the loaded groups from these results. */
type LoadToolsOutput = {
	groups: LoadToolsGroupResult[];
};

export const loadToolsTool = (
	session: AssistantSession,
): AssistantTool<z.infer<typeof loadToolsInputSchema>, LoadToolsOutput> =>
	assistantTool({
		description:
			"Load tool groups for the rest of this conversation. Their tools are callable from your next step. Loading a group that is already loaded changes nothing.",
		inputSchema: loadToolsInputSchema,
		execute: ({ groups }) => {
			const offered = offeredToolGroups(session.capabilities);

			return {
				groups: [
					...new Set(groups),
				].map(
					(group): LoadToolsGroupResult =>
						offered.includes(group)
							? loadedGroup(
									group,
									offeredGroupTools(group, session.capabilities),
									session.isPlanApproved(),
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
			session.modelOutput(
				output,
				output.groups.flatMap((result) =>
					result.loaded
						? offeredGroupTools(result.group, session.capabilities).filter(
								(name) => !isCreateTool(name) || result.tools.includes(name),
							)
						: [],
				),
			),
	});
