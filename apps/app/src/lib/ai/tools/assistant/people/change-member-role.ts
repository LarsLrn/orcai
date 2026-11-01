import { organizationMemberSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { receiverIdSchema, receiverOf } from "./receiver";

const changeMemberRoleInputSchema = organizationMemberSchema
	.pick({
		userId: true,
		role: true,
	})
	.extend({
		userId: organizationMemberSchema.shape.userId.describe(
			"Id of the member, from listMembers.",
		),
		receiverId: receiverIdSchema.describe(
			"Only when the role becomes viewer: id of the member, from listMembers, who receives the bots, blocks and Library assets this member owns here. Must be a Member, Manager or Admin who is not banned. Leave out to give them to the user, which works only when the user is a Member, Manager or Admin here.",
		),
	})
	.strict();

export const changeMemberRoleTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Change a member's role in the active organisation. Only admins can make or unmake admins, and the last admin keeps the role. A Viewer cannot own content, so a member made a Viewer hands the bots, blocks and Library assets they own here to one receiver, and the result names the receiver and what moved.",
		inputSchema: changeMemberRoleInputSchema,
		run: ({ userId, role, receiverId }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationMember.update(
					{
						userId,
						role,
						receiverId,
					},
					options,
				),
			).pipe(
				mutation("listMembers"),
				expectType("member", userId),
				Effect.flatMap(({ data, handedOver }) =>
					receiverOf(deps, handedOver).pipe(
						Effect.map((moved) => ({
							type: "member" as const,
							id: data.userId,
							role: data.role,
							...moved,
						})),
					),
				),
			),
	});
