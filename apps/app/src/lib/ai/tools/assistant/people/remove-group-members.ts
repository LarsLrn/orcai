import { removeGroupMembersInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { groupProcedures } from "@/lib/orpc/router/group";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

export const removeGroupMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Remove users from a custom group, by user id (from listGroupMembers). They lose the access the group holds; their organisation membership stays.",
		inputSchema: removeGroupMembersInputSchema,
		run: (input) =>
			callProcedure(deps, (options) =>
				groupProcedures.removeMembers(input, options),
			).pipe(
				mutation("listGroupMembers"),
				expectType("group", input.groupId),
				expectType("member", input.userIds),
				Effect.map(({ message }) => ({
					type: "group" as const,
					id: input.groupId,
					userIds: input.userIds,
					message,
				})),
			),
	});
