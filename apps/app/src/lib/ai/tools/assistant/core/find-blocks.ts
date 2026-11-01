import { blockTypeSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const findBlocksInputSchema = z.strictObject({
	type: blockTypeSchema.describe(
		"behaviour: the system prompt a bot follows. repository: assets a bot searches to answer from.",
	),
	query: listQuerySchema,
	limit: listLimitSchema,
});

export const findBlocksTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find behaviours or repositories by name: published ones the user can read and drafts they can edit. Without a query it lists them all, newest first.",
		inputSchema: findBlocksInputSchema,
		run: ({ type, query, limit }) =>
			Effect.gen(function* () {
				const blocks = yield* callProcedure(deps, (procedures, options) =>
					procedures.block.list(
						{
							pageSize: limit,
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
					total: blocks.rowCount,
				};
			}),
	});
