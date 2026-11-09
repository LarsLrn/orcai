import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	mutation,
} from "../procedure-tool";
import { createGroupInputSchema } from "./create-group.declaration";
import { groupOutline } from "./group-outline";

export const createGroupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new group in the active organisation. To rename or describe an existing group, use updateGroup.",
		inputSchema: createGroupInputSchema,
		run: (input) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.create(
					{
						name: input.name,
						description: input.description,
					},
					options,
				),
			).pipe(mutation("listGroups"), Effect.map(groupOutline)),
	});
