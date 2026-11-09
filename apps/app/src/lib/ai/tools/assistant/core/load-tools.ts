import type { z } from "zod/v4";
import type { AssistantSession } from "@/lib/ai/tools/assistant/session";
import type { DeferredToolGroup } from "@/lib/ai/tools/declaration";
import {
	type AssistantTool,
	assistantTool,
} from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolName,
	isCreateTool,
	offeredGroupTools,
	offeredToolGroups,
} from "../groups";
import { loadToolsInputSchema } from "./load-tools.declaration";

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
