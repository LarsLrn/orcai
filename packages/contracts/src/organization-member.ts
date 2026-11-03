import {
	deleteOrganizationMembersInputSchema,
	deleteOrganizationMembersResponseSchema,
	findOrganizationMemberInputSchema,
	findOrganizationMemberResponseSchema,
	listContentReceiversInputSchema,
	listContentReceiversResponseSchema,
	listMemberAccessInputSchema,
	listMemberAccessResponseSchema,
	listOrganizationMembersInputSchema,
	listOrganizationMembersResponseSchema,
	listOwnedContentInputSchema,
	listOwnedContentResponseSchema,
	updateOrganizationMemberInputSchema,
	updateOrganizationMemberResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Organisation members",
		],
	}),
);

export const organizationMemberContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/members",
				summary: "List members of the active organisation",
			}),
		)
		.input(listOrganizationMembersInputSchema)
		.output(listOrganizationMembersResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/members/{userId}",
				summary: "Find a member of the active organisation",
			}),
		)
		.input(findOrganizationMemberInputSchema)
		.output(findOrganizationMemberResponseSchema),
	listAccess: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/members/{userId}/access",
				summary: "List the items a member has access to, and how",
			}),
		)
		.input(listMemberAccessInputSchema)
		.output(listMemberAccessResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/members/{userId}",
				summary: "Update a member of the active organisation",
			}),
		)
		.input(updateOrganizationMemberInputSchema)
		.output(updateOrganizationMemberResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/members",
				summary: "Remove members from the active organisation",
			}),
		)
		.input(deleteOrganizationMembersInputSchema)
		.output(deleteOrganizationMembersResponseSchema),
	ownedContent: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/members/owned-content",
				summary: "List what members own in the active organisation",
			}),
		)
		.input(listOwnedContentInputSchema)
		.output(listOwnedContentResponseSchema),
	receivers: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/members/receivers",
				summary: "List the members who can take over what another member owns",
			}),
		)
		.input(listContentReceiversInputSchema)
		.output(listContentReceiversResponseSchema),
};
