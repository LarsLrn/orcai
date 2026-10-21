import { organizationMemberSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const changeMemberRoleInputSchema = organizationMemberSchema
	.pick({
		userId: true,
		role: true,
	})
	.extend({
		userId: organizationMemberSchema.shape.userId.describe(
			"Id of the member, from listMembers.",
		),
	});

export const changeMemberRoleTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Change a member's role in the active organisation. Only admins can make or unmake admins, and the last admin keeps the role.",
		inputSchema: changeMemberRoleInputSchema,
		run: ({ userId, role }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationMember.update(
					{
						userId,
						role,
					},
					options,
				),
			).pipe(
				mutation("listMembers"),
				expectType("member", userId),
				Effect.map(({ data }) => ({
					type: "member" as const,
					id: data.userId,
					role: data.role,
				})),
			),
	});
