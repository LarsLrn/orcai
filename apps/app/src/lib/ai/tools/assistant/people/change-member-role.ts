import { organizationMemberSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { organizationMemberProcedures } from "@/lib/orpc/router/organization-member";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	expectType,
	mutation,
	runAssistantTool,
} from "../procedure-tool";

export const changeMemberRoleInputSchema = organizationMemberSchema
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
	assistantTool({
		description:
			"Change a member's role in the active organisation. Only admins can make or unmake admins, and the last admin keeps the role. The user confirms before it runs.",
		inputSchema: changeMemberRoleInputSchema,
		execute: ({ userId, role }, { abortSignal }) =>
			runAssistantTool(
				callProcedure(deps, (options) =>
					organizationMemberProcedures.update(
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
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
