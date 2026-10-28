import type { UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

const removeMembersInputSchema = z.strictObject({
	userIds: z
		.array(userIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the members to remove, from listMembers."),
});

export const removeMembers = (deps: AssistantToolDeps, userIds: UserId[]) =>
	deleteNamed(deps, userIds, {
		type: "member",
		find: (id, procedures, options) =>
			procedures.user.find(
				{
					id,
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
				},
				options,
			),
	}).pipe(
		Effect.map(({ deleted }) => ({
			removed: deleted,
		})),
	);

export const removeMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Remove members from the active organisation. They lose their role, their group memberships and the access granted to them there. Only admins can remove admins, and the last admin stays.",
		inputSchema: removeMembersInputSchema,
		run: ({ userIds }) => removeMembers(deps, userIds),
	});
