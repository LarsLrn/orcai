import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { invitation } from "@/db/schema/organization";
import { base } from "./base";

export const organizationInvitationSelectSchema =
	createSelectSchema(invitation);

export const organizationInvitationInsertSchema = z.object({
	organizationId:
		organizationInvitationSelectSchema.shape.organizationId.nonempty(
			"Please select an organization",
		),
	role: organizationInvitationSelectSchema.shape.role,
	expiresAt: organizationInvitationSelectSchema.shape.expiresAt, // TODO: Set constraints
	items: z
		.array(
			z.object({
				email: z.email("Field must be a valid email"),
			}),
		)
		.min(1, "Please add at least one email")
		.max(200, "Max 200 emails")
		.check((ctx) => {
			const emails = ctx.value.map((item) => item.email.toLowerCase());
			const uniqueEmails = new Set(emails);

			if (uniqueEmails.size !== emails.length) {
				ctx.issues.push({
					code: "custom",
					message: "Emails must be unique",
					path: ["root"],
					input: "",
				});
			}
		}),
});

export const organizationInvitationUpdateSchema = createUpdateSchema(
	invitation,
	{
		organizationId: organizationInvitationSelectSchema.shape.organizationId,
		id: organizationInvitationSelectSchema.shape.id,
	},
);

export const organizationInvitationDeleteSchema = z.object({
	organizationId: organizationInvitationSelectSchema.shape.organizationId,
	refs: z.array(
		organizationInvitationUpdateSchema.pick({ organizationId: true, id: true }),
	),
});

// TODO: Refactor. There should be endpoints for a) getting all invitations within a course, b) getting all invitations for a user
export const listOrganizationInvitationsContract = base
	.route({
		method: "GET",
		path: "/organizations/invitations",
		summary: "List all organization invitations",
		tags: ["Organization Invitations"],
	})
	.input(
		z.object({
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
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
		tags: ["Organization Invitations"],
	})
	.input(organizationInvitationInsertSchema)
	.output(z.object({ data: z.array(organizationInvitationSelectSchema) }));

export const findOrganizationInvitationContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/invitations/{id}",
		summary: "Find an organization invitation",
		tags: ["Organization Invitations"],
	})
	.input(
		z.object({
			organizationId: z.uuidv4(),
			id: organizationInvitationSelectSchema.shape.id,
		}),
	)
	.output(z.object({ data: organizationInvitationSelectSchema }));

export const updateOrganizationInvitationContract = base
	.route({
		method: "PUT",
		path: "/organizations/{organizationId}/invitations/{id}",
		summary: "Update an organization invitation",
		tags: ["Organization Invitations"],
	})
	.errors({
		NOT_FOUND: {
			message: "Organization invitation not found",
			data: z.object({ id: organizationInvitationUpdateSchema.shape.id }),
		},
	})
	.input(organizationInvitationUpdateSchema)
	.output(z.object({ data: organizationInvitationSelectSchema }));

export const deleteOrganizationInvitationsContract = base
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/invitations",
		summary: "Delete a organization invitations",
		tags: ["Organization Invitations"],
	})
	.input(organizationInvitationDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));

export const respondToOrganizationInvitationContract = base
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/invitations/{id}/respond",
		summary: "Respond to an organization invitation",
		tags: ["Organization Invitations"],
	})
	.input(
		z.object({
			id: organizationInvitationSelectSchema.shape.id,
			response: z.enum(["accept", "reject"]),
		}),
	)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
