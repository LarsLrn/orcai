import { z } from "zod/v4";
import {
	groupAddMembersInputSchema,
	groupDeleteSchema,
	groupFindInputSchema,
	groupFindResponseSchema,
	groupInsertSchema,
	groupListMembersInputSchema,
	groupListMembersResponseSchema,
	groupListResponseSchema,
	groupMembersMutateResponseSchema,
	groupRemoveMembersInputSchema,
	groupUpdateSchema,
	groupWriteResponseSchema,
} from "@/lib/orpc/schemas/group";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listGroupsContract = base
	.route({
		method: "GET",
		path: "/groups",
		summary: "List groups in active organization",
		tags: [
			"Groups",
		],
	})
	.input(
		z.object({
			filters: z
				.object({
					search: z.string().trim().max(100).optional(),
				})
				.optional(),
			...paginationSchema.shape,
		}),
	)
	.output(groupListResponseSchema);

export const createGroupContract = base
	.route({
		method: "POST",
		path: "/groups",
		summary: "Create a custom group",
		tags: [
			"Groups",
		],
	})
	.input(groupInsertSchema)
	.output(groupWriteResponseSchema);

export const findGroupContract = base
	.route({
		method: "GET",
		path: "/groups/{id}",
		summary: "Find a group",
		tags: [
			"Groups",
		],
	})
	.input(groupFindInputSchema)
	.output(groupFindResponseSchema);

export const updateGroupContract = base
	.route({
		method: "PUT",
		path: "/groups/{id}",
		summary: "Update a custom group",
		tags: [
			"Groups",
		],
	})
	.input(groupUpdateSchema)
	.output(groupWriteResponseSchema);

export const deleteGroupContract = base
	.route({
		method: "DELETE",
		path: "/groups",
		summary: "Delete groups",
		tags: [
			"Groups",
		],
	})
	.input(groupDeleteSchema)
	.output(groupMembersMutateResponseSchema);

export const listGroupMembersContract = base
	.route({
		method: "GET",
		path: "/groups/{groupId}/members",
		summary: "List group members",
		tags: [
			"Groups",
		],
	})
	.input(groupListMembersInputSchema)
	.output(groupListMembersResponseSchema);

export const addGroupMembersContract = base
	.route({
		method: "POST",
		path: "/groups/{groupId}/members",
		summary: "Add users to a custom group",
		tags: [
			"Groups",
		],
	})
	.input(groupAddMembersInputSchema)
	.output(groupMembersMutateResponseSchema);

export const removeGroupMembersContract = base
	.route({
		method: "DELETE",
		path: "/groups/{groupId}/members",
		summary: "Remove users from a custom group",
		tags: [
			"Groups",
		],
	})
	.input(groupRemoveMembersInputSchema)
	.output(groupMembersMutateResponseSchema);
