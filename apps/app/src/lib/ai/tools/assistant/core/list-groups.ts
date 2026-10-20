import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { groupProcedures } from "@/lib/orpc/router/group";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	runAssistantTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

export const listGroupsInputSchema = z.object({
	query: listQuerySchema,
	limit: listLimitSchema,
});

export const listGroupsTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"List the groups of the active organisation that the user can see, by name. System groups such as All Members are managed by OrcAI.",
		inputSchema: listGroupsInputSchema,
		execute: ({ query, limit }, { abortSignal }) =>
			runAssistantTool(
				callProcedure(deps, (options) =>
					groupProcedures.list(
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
							type: "group" as const,
							id: group.id,
							name: group.name,
							description: group.description,
							kind: group.kind,
						})),
						total: rowCount,
					})),
				),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
