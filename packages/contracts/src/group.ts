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

const tagged = base.meta(
	openapi({
		tags: [
			"Groups",
		],
	}),
);

export const groupContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/groups",
				summary: "List groups in active organisation",
			}),
		)
		.input(listGroupsInputSchema)
		.output(listGroupsResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/groups",
				summary: "Create a custom group",
			}),
		)
		.input(createGroupInputSchema)
		.output(groupWriteResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{id}",
				summary: "Find a group",
			}),
		)
		.input(findGroupInputSchema)
		.output(findGroupResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/groups/{id}",
				summary: "Update a custom group",
			}),
		)
		.input(updateGroupInputSchema)
		.output(groupWriteResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/groups",
				summary: "Delete groups",
			}),
		)
		.input(deleteGroupsInputSchema)
		.output(groupMembersMutateResponseSchema),
	listMembers: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{groupId}/members",
				summary: "List group members",
			}),
		)
		.input(listGroupMembersInputSchema)
		.output(listGroupMembersResponseSchema),
	listCandidates: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/groups/{groupId}/candidates",
				summary: "List organisation members who are not yet in a custom group",
			}),
		)
		.input(listGroupCandidatesInputSchema)
		.output(listGroupCandidatesResponseSchema),
	addMembers: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/groups/{groupId}/members",
				summary: "Add users to a custom group",
			}),
		)
		.input(addGroupMembersInputSchema)
		.output(groupMembersMutateResponseSchema),
	removeMembers: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/groups/{groupId}/members",
				summary: "Remove users from a custom group",
			}),
		)
		.input(removeGroupMembersInputSchema)
		.output(groupMembersMutateResponseSchema),
};
