import { addGroupMembersInputSchema } from "@orcai/schema";
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

export const addGroupMembersTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Add members of the active organisation to a custom group, by user id (from listMembers). They gain the access the group holds. The user confirms before it runs.",
		inputSchema: addGroupMembersInputSchema,
		execute: (input, { abortSignal }) =>
			runAssistantTool(
				callProcedure(deps, (options) =>
					groupProcedures.addMembers(input, options),
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
