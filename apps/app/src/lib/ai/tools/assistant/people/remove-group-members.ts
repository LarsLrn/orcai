import { removeGroupMembersInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { groupProcedures } from "@/lib/orpc/router/group";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	expectType,
	mutation,
	runAssistantTool,
} from "../procedure-tool";

export const removeGroupMembersTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Remove users from a custom group, by user id (from listGroupMembers). They lose the access the group holds; their organisation membership stays. The user confirms before it runs.",
		inputSchema: removeGroupMembersInputSchema,
		execute: (input, { abortSignal }) =>
			runAssistantTool(
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
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
