import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { listGroupsInputSchema } from "./list-groups.declaration";

export const listGroupsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `List the groups of the active organisation that the user can see, newest first, optionally only those whose name matches. System groups such as All members are managed by OrcAI. ${PAGING_NOTE}`,
		inputSchema: listGroupsInputSchema,
		run: ({ query, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.list(
					{
						...listPage(page),
						filters: {
							search: query,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					groups: data.map((group) => ({
						id: group.id,
						name: group.name,
						description: group.description,
						kind: group.kind,
					})),
					...listPaging(page, rowCount),
				})),
			),
	});
