import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const listGroupsInputSchema = z.strictObject({
	query: listQuerySchema,
	limit: listLimitSchema,
});

export const listGroupsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List the groups of the active organisation that the user can see, by name. System groups such as All Members are managed by OrcAI.",
		inputSchema: listGroupsInputSchema,
		run: ({ query, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.list(
					{
						pageSize: limit,
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
					total: rowCount,
				})),
			),
	});
