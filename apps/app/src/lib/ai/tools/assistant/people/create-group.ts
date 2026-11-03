import { groupFieldsSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import { groupOutline } from "./group-outline";

const createGroupInputSchema = groupFieldsSchema.strict();

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
