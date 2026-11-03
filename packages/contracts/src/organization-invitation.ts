import {
	createOrganizationInvitationsInputSchema,
	createOrganizationInvitationsResponseSchema,
	deleteOrganizationInvitationsInputSchema,
	deleteOrganizationInvitationsResponseSchema,
	findOrganizationInvitationInputSchema,
	findOrganizationInvitationResponseSchema,
	listMyOrganizationInvitationsResponseSchema,
	listOrganizationInvitationsInputSchema,
	listOrganizationInvitationsResponseSchema,
	respondToOrganizationInvitationInputSchema,
	respondToOrganizationInvitationResponseSchema,
	updateOrganizationInvitationInputSchema,
	updateOrganizationInvitationResponseSchema,
	validateOrganizationInvitationInputSchema,
	validateOrganizationInvitationResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base, withoutSession } from "./base";

export const organizationInvitationContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/invitations",
				summary: "List invitations of the active organization",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(listOrganizationInvitationsInputSchema)
		.output(listOrganizationInvitationsResponseSchema),
	listMine: base
		.meta(
			openapi({
				method: "GET",
				path: "/users/me/invitations",
				summary: "List invitations addressed to the current user",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(listOrganizationInvitationsInputSchema)
		.output(listMyOrganizationInvitationsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/invitations",
				summary: "Invite many users to the active organization",
				tags: [
					"Organization Invitations",
				],
				description:
					"Skips addresses that already belong to a member or have an invitation that has not expired, and names them in `skipped`. An expired invitation is replaced by a new one.",
			}),
		)
		.input(createOrganizationInvitationsInputSchema)
		.output(createOrganizationInvitationsResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/invitations/{id}",
				summary: "Find an organization invitation",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(findOrganizationInvitationInputSchema)
		.output(findOrganizationInvitationResponseSchema),
	validate: base
		.meta(
			openapi({
				method: "GET",
				path: "/invitations/{id}/validate",
				summary: "Validate an organization invitation",
				tags: [
					"Organization Invitations",
				],
				spec: withoutSession,
			}),
		)
		.input(validateOrganizationInvitationInputSchema)
		.output(validateOrganizationInvitationResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/invitations/{id}",
				summary: "Update an invitation of the active organization",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(updateOrganizationInvitationInputSchema)
		.output(updateOrganizationInvitationResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/invitations",
				summary: "Delete invitations of the active organization",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(deleteOrganizationInvitationsInputSchema)
		.output(deleteOrganizationInvitationsResponseSchema),
	respond: base
		.meta(
			openapi({
				method: "POST",
				path: "/invitations/{id}/respond",
				summary: "Respond to an organization invitation",
				tags: [
					"Organization Invitations",
				],
			}),
		)
		.input(respondToOrganizationInvitationInputSchema)
		.output(respondToOrganizationInvitationResponseSchema),
};
