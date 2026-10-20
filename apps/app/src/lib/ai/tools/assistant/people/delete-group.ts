import type { GroupId } from "@orcai/core";
import { groupIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { groupProcedures } from "@/lib/orpc/router/group";
import { deleteNamed } from "../named-delete";
import {
	type AssistantToolDeps,
	assistantTool,
	runAssistantTool,
} from "../procedure-tool";

export const deleteGroupInputSchema = z.object({
	ids: z
		.array(groupIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the groups to delete, from listGroups."),
});

export const deleteGroups = (deps: AssistantToolDeps, ids: GroupId[]) =>
	deleteNamed(deps, ids, {
		type: "group",
		find: (id, options) =>
			groupProcedures.find(
				{
					id,
				},
				options,
			),
		name: ({ data }) => data.name,
		verify: "listGroups",
		remove: (ids, options) =>
			groupProcedures.delete(
				{
					refs: ids.map((id) => ({
						id,
					})),
				},
				options,
			),
	}).pipe(
		Effect.map(({ deleted }) => ({
			deleted,
		})),
	);

export const deleteGroupTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Delete groups of the active organisation. Their members lose the access the groups granted. System groups cannot be deleted. The user confirms before it runs.",
		inputSchema: deleteGroupInputSchema,
		execute: ({ ids }, { abortSignal }) =>
			runAssistantTool(deleteGroups(deps, ids), abortSignal),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
