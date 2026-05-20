import {
	createOrganizationInvitationsInputSchema,
	createOrganizationInvitationsResponseSchema,
	deleteOrganizationInvitationsInputSchema,
	deleteOrganizationInvitationsResponseSchema,
	findOrganizationInvitationInputSchema,
	findOrganizationInvitationResponseSchema,
	listOrganizationInvitationsInputSchema,
	listOrganizationInvitationsResponseSchema,
	respondToOrganizationInvitationInputSchema,
	respondToOrganizationInvitationResponseSchema,
	updateOrganizationInvitationInputSchema,
	updateOrganizationInvitationResponseSchema,
	validateOrganizationInvitationInputSchema,
	validateOrganizationInvitationResponseSchema,
} from "@orcai/schema";
import { base } from "./base";

export const organizationInvitationContracts = {
	list: base
		.route({
			method: "GET",
			path: "/organizations/invitations",
			summary: "List all organization invitations",
			tags: [
				"Organization Invitations",
			],
		})
		.input(listOrganizationInvitationsInputSchema)
		.output(listOrganizationInvitationsResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/organizations/{organizationId}/invitations",
			summary: "Create many organization invitations",
			tags: [
				"Organization Invitations",
			],
		})
		.input(createOrganizationInvitationsInputSchema)
		.output(createOrganizationInvitationsResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/invitations/{id}",
			summary: "Find an organization invitation",
			tags: [
				"Organization Invitations",
			],
		})
		.input(findOrganizationInvitationInputSchema)
		.output(findOrganizationInvitationResponseSchema),
	validate: base
		.route({
			method: "GET",
			path: "/invitations/{id}/validate",
			summary: "Validate an organization invitation",
			tags: [
				"Organization Invitations",
			],
		})
		.input(validateOrganizationInvitationInputSchema)
		.output(validateOrganizationInvitationResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/organizations/{organizationId}/invitations/{id}",
			summary: "Update an organization invitation",
			tags: [
				"Organization Invitations",
			],
		})
		.input(updateOrganizationInvitationInputSchema)
		.output(updateOrganizationInvitationResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/organizations/{organizationId}/invitations",
			summary: "Delete a organization invitations",
			tags: [
				"Organization Invitations",
			],
		})
		.input(deleteOrganizationInvitationsInputSchema)
		.output(deleteOrganizationInvitationsResponseSchema),
	respond: base
		.route({
			method: "POST",
			path: "/invitations/{id}/respond",
			summary: "Respond to an organization invitation",
			tags: [
				"Organization Invitations",
			],
		})
		.input(respondToOrganizationInvitationInputSchema)
		.output(respondToOrganizationInvitationResponseSchema),
};
