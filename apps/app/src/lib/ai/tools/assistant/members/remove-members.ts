import type { UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { receiverOf } from "./receiver";
import { removeMembersInputSchema } from "./remove-members.declaration";

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
