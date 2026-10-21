import { listGroupMembersInputSchema as groupMembersQuerySchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { groupProcedures } from "@/lib/orpc/router/group";
import { listLimitSchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
} from "../procedure-tool";

const listGroupMembersInputSchema = groupMembersQuerySchema
	.pick({
		groupId: true,
		query: true,
	})
	.extend({
		query: groupMembersQuerySchema.shape.query.describe(
			"Part of the name or email to search for, case-insensitive.",
		),
		limit: listLimitSchema,
	});

export const listGroupMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List the members of a group. Members of the All Members group are every organisation member (source implicit).",
		inputSchema: listGroupMembersInputSchema,
		run: ({ groupId, query, limit }) =>
			callProcedure(deps, (options) =>
				groupProcedures.listMembers(
					{
						groupId,
						query,
						pageSize: limit,
					},
					options,
				),
			).pipe(
				expectType("group", groupId),
				Effect.map(({ data, rowCount }) => ({
					members: data.map((row) => ({
						type: "member" as const,
						id: row.user.id,
						name: row.user.name,
						email: row.user.email,
						source: row.source,
					})),
					total: rowCount,
				})),
			),
	});
