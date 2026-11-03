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

const tagged = base.meta(
	openapi({
		tags: [
			"Organisation invitations",
		],
	}),
);

export const organizationInvitationContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/invitations",
				summary: "List invitations of the active organisation",
			}),
		)
		.input(listOrganizationInvitationsInputSchema)
		.output(listOrganizationInvitationsResponseSchema),
	listMine: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/users/me/invitations",
				summary: "List invitations addressed to the current user",
			}),
		)
		.input(listOrganizationInvitationsInputSchema)
		.output(listMyOrganizationInvitationsResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/invitations",
				summary: "Invite many users to the active organisation",
				description:
					"Skips addresses that already belong to a member or have an invitation that has not expired, and names them in `skipped`. An expired invitation is replaced by a new one.",
			}),
		)
		.input(createOrganizationInvitationsInputSchema)
		.output(createOrganizationInvitationsResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/invitations/{id}",
				summary: "Find an organisation invitation",
			}),
		)
		.input(findOrganizationInvitationInputSchema)
		.output(findOrganizationInvitationResponseSchema),
	validate: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/invitations/{id}/validate",
				summary: "Validate an organisation invitation",
				spec: withoutSession,
			}),
		)
		.input(validateOrganizationInvitationInputSchema)
		.output(validateOrganizationInvitationResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/invitations/{id}",
				summary: "Update an invitation of the active organisation",
			}),
		)
		.input(updateOrganizationInvitationInputSchema)
		.output(updateOrganizationInvitationResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/invitations",
				summary: "Delete invitations of the active organisation",
			}),
		)
		.input(deleteOrganizationInvitationsInputSchema)
		.output(deleteOrganizationInvitationsResponseSchema),
	respond: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/invitations/{id}/respond",
				summary: "Respond to an organisation invitation",
			}),
		)
		.input(respondToOrganizationInvitationInputSchema)
		.output(respondToOrganizationInvitationResponseSchema),
};
