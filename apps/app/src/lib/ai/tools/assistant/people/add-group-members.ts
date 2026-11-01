import { addGroupMembersInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

export const addGroupMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Add members of the active organisation to a custom group, by user id from listMembers. They gain the access the group holds.",
		inputSchema: addGroupMembersInputSchema.strict(),
		run: (input) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.addMembers(input, options),
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
