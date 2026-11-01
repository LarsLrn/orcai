import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema } from "./list-input";

const listMembersInputSchema = z.strictObject({
	query: z
		.string()
		.trim()
		.max(100)
		.optional()
		.describe("Part of the name or email to search for, case-insensitive."),
	limit: listLimitSchema,
});

export const listMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List the members of the active organisation with their names, emails and organisation roles. Use it to find the user id the people tools take.",
		inputSchema: listMembersInputSchema,
		run: ({ query, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationMember.list(
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
					members: data.map((user) => ({
						id: user.id,
						name: user.name,
						email: user.email,
						organizationRole: user.organizationRole,
					})),
					total: rowCount,
				})),
			),
	});
