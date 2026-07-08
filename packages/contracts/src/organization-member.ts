import {
	createOrganizationMemberInputSchema,
	createOrganizationMemberResponseSchema,
	deleteOrganizationMembersInputSchema,
	deleteOrganizationMembersResponseSchema,
	findOrganizationMemberInputSchema,
	findOrganizationMemberResponseSchema,
	listOrganizationMembersInputSchema,
	listOrganizationMembersResponseSchema,
	updateOrganizationMemberInputSchema,
	updateOrganizationMemberResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const organizationMemberContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{organizationId}/members",
				summary: "List all members of an organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(listOrganizationMembersInputSchema)
		.output(listOrganizationMembersResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/organizations/{organizationId}/members",
				summary: "Create a member for an organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(createOrganizationMemberInputSchema)
		.output(createOrganizationMemberResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{organizationId}/members/{userId}",
				summary: "Find a member of an organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(findOrganizationMemberInputSchema)
		.output(findOrganizationMemberResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/organizations/{organizationId}/members/{userId}",
				summary: "Update a member of an organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(updateOrganizationMemberInputSchema)
		.output(updateOrganizationMemberResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/organizations/{organizationId}/members",
				summary: "Delete a member of an organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(deleteOrganizationMembersInputSchema)
		.output(deleteOrganizationMembersResponseSchema),
};
