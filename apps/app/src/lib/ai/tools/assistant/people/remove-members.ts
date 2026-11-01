import type { UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";
import { receiverIdSchema, receiverOf } from "./receiver";

const removeMembersInputSchema = z.strictObject({
	userIds: z
		.array(userIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the members to remove, from listMembers."),
	receiverId: receiverIdSchema.describe(
		"Id of the member, from listMembers, who receives the bots, blocks and Library assets the removed members own here. Must be a Member, Manager or Admin who is not banned and not removed in this call. Leave out to give them to the user, which works only when the user is a Member, Manager or Admin here.",
	),
});

export const removeMembers = (
	deps: AssistantToolDeps,
	userIds: UserId[],
	receiverId?: UserId,
) =>
	deleteNamed(deps, userIds, {
		type: "member",
		find: (id, procedures, options) =>
			procedures.organizationMember.find(
				{
					userId: id,
				},
				options,
			),
		name: ({ data }) => data.name,
		verify: "listMembers",
		remove: (ids, procedures, options) =>
			procedures.organizationMember.delete(
				{
					refs: ids.map((userId) => ({
						userId,
					})),
					receiverId,
				},
				options,
			),
	}).pipe(
		Effect.flatMap(({ deleted, removed }) =>
			receiverOf(deps, removed?.handedOver ?? null).pipe(
				Effect.map((handedOver) => ({
					removed: deleted,
					...handedOver,
				})),
			),
		),
	);

export const removeMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Remove members from the active organisation. They lose their role, their group memberships and the access granted to them there. The bots, blocks and Library assets they own here go to one receiver, and the result names the receiver and what moved. Chats and chat uploads stay theirs. Only admins can remove admins, and the last admin stays.",
		inputSchema: removeMembersInputSchema,
		run: ({ userIds, receiverId }) => removeMembers(deps, userIds, receiverId),
	});
