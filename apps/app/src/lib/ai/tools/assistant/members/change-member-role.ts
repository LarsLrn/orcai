import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import { changeMemberRoleInputSchema } from "./change-member-role.declaration";
import { receiverOf } from "./receiver";

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
