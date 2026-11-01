import { removeGroupMembersInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
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
			"Remove members from a custom group, by user id from listGroupMembers. They lose the access the group holds and stay members of the organisation.",
		inputSchema: removeGroupMembersInputSchema.strict(),
		run: (input) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.removeMembers(input, options),
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
