import {
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
				path: "/members",
				summary: "List members of the active organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(listOrganizationMembersInputSchema)
		.output(listOrganizationMembersResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/members/{userId}",
				summary: "Find a member of the active organization",
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
				path: "/members/{userId}",
				summary: "Update a member of the active organization",
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
				path: "/members",
				summary: "Remove members from the active organization",
				tags: [
					"Organization Members",
				],
			}),
		)
		.input(deleteOrganizationMembersInputSchema)
		.output(deleteOrganizationMembersResponseSchema),
};
