import { updateGroupInputSchema as updateGroupProcedureInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { groupProcedures } from "@/lib/orpc/router/group";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { groupOutline } from "./group-outline";

const updateGroupInputSchema = updateGroupProcedureInputSchema.extend({
	id: updateGroupProcedureInputSchema.shape.id.describe(
		"Id of the group to update.",
	),
	name: updateGroupProcedureInputSchema.shape.name.describe(
		"Leave out to keep the current name.",
	),
	description: updateGroupProcedureInputSchema.shape.description.describe(
		"Leave out to keep the current description; null clears it.",
	),
});

export const updateGroupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Rename an existing group or change its description. Give only the fields that change. System groups such as All Members cannot be changed. To create a group, use createGroup.",
		inputSchema: updateGroupInputSchema,
		run: ({ id, name, description }) =>
			callProcedure(deps, (options) =>
				groupProcedures.update(
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
