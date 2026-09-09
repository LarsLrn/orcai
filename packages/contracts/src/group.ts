import {
	addGroupMembersInputSchema,
	createGroupInputSchema,
	deleteGroupsInputSchema,
	findGroupInputSchema,
	findGroupResponseSchema,
	groupMembersMutateResponseSchema,
	groupWriteResponseSchema,
	listGroupCandidatesInputSchema,
	listGroupCandidatesResponseSchema,
	listGroupMembersInputSchema,
	listGroupMembersResponseSchema,
	listGroupsInputSchema,
	listGroupsResponseSchema,
	removeGroupMembersInputSchema,
	updateGroupInputSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const groupContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/groups",
				summary: "List groups in active organization",
				tags: [
					"Groups",
				],
			}),
		)
		.input(listGroupsInputSchema)
		.output(listGroupsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/groups",
				summary: "Create a custom group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(createGroupInputSchema)
		.output(groupWriteResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{id}",
				summary: "Find a group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(findGroupInputSchema)
		.output(findGroupResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/groups/{id}",
				summary: "Update a custom group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(updateGroupInputSchema)
		.output(groupWriteResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/groups",
				summary: "Delete groups",
				tags: [
					"Groups",
				],
			}),
		)
		.input(deleteGroupsInputSchema)
		.output(groupMembersMutateResponseSchema),
	listMembers: base
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{groupId}/members",
				summary: "List group members",
				tags: [
					"Groups",
				],
			}),
		)
		.input(listGroupMembersInputSchema)
		.output(listGroupMembersResponseSchema),
	listCandidates: base
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{groupId}/candidates",
				summary: "List organisation members who are not yet in a custom group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(listGroupCandidatesInputSchema)
		.output(listGroupCandidatesResponseSchema),
	addMembers: base
		.meta(
			openapi({
				method: "POST",
				path: "/groups/{groupId}/members",
				summary: "Add users to a custom group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(addGroupMembersInputSchema)
		.output(groupMembersMutateResponseSchema),
	removeMembers: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/groups/{groupId}/members",
				summary: "Remove users from a custom group",
				tags: [
					"Groups",
				],
			}),
		)
		.input(removeGroupMembersInputSchema)
		.output(groupMembersMutateResponseSchema),
};
