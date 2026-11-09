import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { findBlocksInputSchema } from "./find-blocks.declaration";

export const findBlocksTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find behaviours or repositories by name among the published ones the user can read and the drafts they can edit, newest first. Without a query it pages through all of them. ${PAGING_NOTE}`,
		inputSchema: findBlocksInputSchema,
		run: ({ type, query, page }) =>
			Effect.gen(function* () {
				const blocks = yield* callProcedure(deps, (procedures, options) =>
					procedures.block.list(
						{
							...listPage(page),
							filters: {
								type,
								status: "all",
								search: query,
							},
						},
						options,
					),
				);

				return {
					blocks: blocks.data.map((block) => ({
						id: block.id,
						name: block.name,
						description: block.description,
						status: block.status,
						canEdit: block.capabilities.edit === true,
					})),
					...listPaging(page, blocks.rowCount),
				};
			}),
	});
