import type { UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { organizationMemberProcedures } from "@/lib/orpc/router/organization-member";
import { userProcedures } from "@/lib/orpc/router/user";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

export const removeMembersInputSchema = z.object({
	userIds: z
		.array(userIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the members to remove, from listMembers."),
});

export const removeMembers = (deps: AssistantToolDeps, userIds: UserId[]) =>
	deleteNamed(deps, userIds, {
		type: "member",
		find: (id, options) =>
			userProcedures.find(
				{
					id,
				},
				options,
			),
		name: ({ data }) => data.name,
		verify: "listMembers",
		remove: (ids, options) =>
			organizationMemberProcedures.delete(
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
