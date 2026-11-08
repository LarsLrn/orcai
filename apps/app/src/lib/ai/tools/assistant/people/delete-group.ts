import type { GroupId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { deleteGroupInputSchema } from "./delete-group.declaration";

export const deleteGroups = (deps: AssistantToolDeps, ids: GroupId[]) =>
	deleteNamed(deps, ids, {
		type: "group",
		find: (id, procedures, options) =>
			procedures.group.find(
				{
					id,
				},
				options,
			),
		name: ({ data }) => data.name,
		verify: "listGroups",
		remove: (ids, procedures, options) =>
			procedures.group.delete(
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
	effectTool({
		description:
			"Delete groups of the active organisation. Their members lose the access the groups granted. System groups such as All members cannot be deleted.",
		inputSchema: deleteGroupInputSchema,
		run: ({ ids }) => deleteGroups(deps, ids),
	});
