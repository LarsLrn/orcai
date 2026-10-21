import type { GroupId } from "@orcai/core";
import { groupFieldsSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { groupProcedures } from "@/lib/orpc/router/group";
import {
	type AssistantToolDeps,
	callProcedure,
	createOnce,
	effectTool,
	mutation,
} from "../procedure-tool";
import { groupOutline } from "./group-outline";

const createGroupInputSchema = groupFieldsSchema;

export const createGroupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new group in the active organisation. To rename or describe an existing group, use updateGroup.",
		inputSchema: createGroupInputSchema,
		run: (input, { toolCallId }) =>
			createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: callProcedure(deps, (options) =>
						groupProcedures.create(
							{
								name: input.name,
								description: input.description,
							},
							options,
						),
					).pipe(mutation("listGroups"), Effect.map(groupOutline)),
					ids: (group) => [
						group.id,
					],
					replay: ([groupId]) =>
						callProcedure(deps, (options) =>
							groupProcedures.find(
								{
									id: groupId as GroupId,
								},
								options,
							),
						).pipe(Effect.map(groupOutline)),
				},
			),
	});
