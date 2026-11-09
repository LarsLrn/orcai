import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import { groupOutline } from "./group-outline";
import { updateGroupInputSchema } from "./update-group.declaration";

export const updateGroupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Rename an existing group or change its description. Give only the fields that change. System groups such as All members cannot be changed. To create a group, use createGroup.",
		inputSchema: updateGroupInputSchema,
		run: ({ id, name, description }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.update(
					{
						id,
						name,
						description,
					},
					options,
				),
			).pipe(
				mutation("listGroups"),
				expectType("group", id),
				Effect.map(groupOutline),
			),
	});
