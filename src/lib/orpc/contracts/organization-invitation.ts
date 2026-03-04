import { z } from "zod/v4";
import {
	organizationInvitationDeleteSchema,
	organizationInvitationInsertSchema,
	organizationInvitationSelectSchema,
	organizationInvitationUpdateSchema,
} from "@/lib/orpc/schemas/organization-invitation";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

// TODO: Refactor. There should be endpoints for a) getting all invitations within a course, b) getting all invitations for a user
export const listOrganizationInvitationsContract = base
	.route({
		method: "GET",
		path: "/organizations/invitations",
		summary: "List all organization invitations",
		tags: [
			"Organization Invitations",
		],
	})
	.input(paginationSchema)
	.output(
		z.object({
			data: z.array(organizationInvitationSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createOrganizationInvitationsContract = base
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/invitations",
		summary: "Create many organization invitations",
		tags: [
			"Organization Invitations",
		],
	})
	.input(organizationInvitationInsertSchema)
	.output(
		z.object({
			data: z.array(organizationInvitationSelectSchema),
		}),
	);

export const findOrganizationInvitationContract = base
	.route({
		method: "GET",
		path: "/invitations/{id}",
		summary: "Find an organization invitation",
		tags: [
			"Organization Invitations",
		],
	})
	.input(
		organizationInvitationSelectSchema.pick({
			id: true,
		}),
	)
	.output(
		z.object({
			data: organizationInvitationSelectSchema,
		}),
	);

export const validateOrganizationInvitationContract = base
	.route({
		method: "GET",
		path: "/invitations/{id}/validate",
		summary: "Validate an organization invitation",
		tags: [
			"Organization Invitations",
		],
	})
	.input(
		organizationInvitationSelectSchema.pick({
			id: true,
		}),
	)
	.output(
		z.object({
			data: z.object({
				isValid: z.boolean(),
				reason: z
					.enum([
						"not_found",
						"consumed",
						"expired",
					])
					.nullable(),
			}),
		}),
	);

export const updateOrganizationInvitationContract = base
	.route({
		method: "PUT",
		path: "/organizations/{organizationId}/invitations/{id}",
		summary: "Update an organization invitation",
		tags: [
			"Organization Invitations",
		],
	})
	.errors({
		NOT_FOUND: {
			message: "Organization invitation not found",
			data: z.object({
				id: organizationInvitationUpdateSchema.shape.id,
			}),
		},
	})
	.input(organizationInvitationUpdateSchema)
	.output(
		z.object({
			data: organizationInvitationSelectSchema,
		}),
	);

export const deleteOrganizationInvitationsContract = base
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/invitations",
		summary: "Delete a organization invitations",
		tags: [
			"Organization Invitations",
		],
	})
	.input(organizationInvitationDeleteSchema)
	.output(statusSchema);

export const respondToOrganizationInvitationContract = base
	.route({
		method: "POST",
		path: "/invitations/{id}/respond",
		summary: "Respond to an organization invitation",
		tags: [
			"Organization Invitations",
		],
	})
	.input(
		z.object({
			id: organizationInvitationSelectSchema.shape.id,
			response: z.enum([
				"accept",
				"reject",
			]),
		}),
	)
	.output(statusSchema);
