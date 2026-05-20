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
import { z } from "zod/v4";
import { base } from "./base";

export const organizationMemberContracts = {
	list: base
		.route({
			method: "GET",
			path: "/organizations/{organizationId}/members",
			summary: "List all members of an organization",
			tags: [
				"Organization Members",
			],
		})
		.input(listOrganizationMembersInputSchema)
		.output(listOrganizationMembersResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/organizations/{organizationId}/members",
			summary: "Create a member for an organization",
			tags: [
				"Organization Members",
			],
		})
		.input(createOrganizationMemberInputSchema)
		.output(createOrganizationMemberResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/organizations/{organizationId}/members/{userId}",
			summary: "Find a member of an organization",
			tags: [
				"Organization Members",
			],
		})
		.input(findOrganizationMemberInputSchema)
		.output(findOrganizationMemberResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/organizations/{organizationId}/members/{userId}",
			summary: "Update a member of an organization",
			tags: [
				"Organization Members",
			],
		})
		.errors({
			NOT_FOUND: {
				message: "Member not found",
				data: z.object({
					organizationId:
						updateOrganizationMemberInputSchema.shape.organizationId,
					userId: updateOrganizationMemberInputSchema.shape.userId,
				}),
			},
		})
		.input(updateOrganizationMemberInputSchema)
		.output(updateOrganizationMemberResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/organizations/{organizationId}/members",
			summary: "Delete a member of an organization",
			tags: [
				"Organization Members",
			],
		})
		.input(deleteOrganizationMembersInputSchema)
		.output(deleteOrganizationMembersResponseSchema),
};
