import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { organizationSelectSchema } from "./organization";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationInvitationSelectSchema = createSelectSchema(
	dbSchema.invitation,
	{
		id: (schema) => schema.brand("organizationInvitationId"),
		organizationId: organizationSelectSchema.shape.id,
	},
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationInvitationInsertSchema = z.object({
	organizationId:
		organizationInvitationSelectSchema.shape.organizationId.nonempty(
			"Please select an organization",
		),
	role: z.string().nonempty("Please select a role"), // TODO: Validate against organizationRoles
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

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationInvitationUpdateSchema = createUpdateSchema(
	dbSchema.invitation,
	{
		organizationId: organizationInvitationSelectSchema.shape.organizationId,
		id: organizationInvitationSelectSchema.shape.id,
	},
);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationInvitationDeleteSchema = z.object({
	organizationId: organizationInvitationSelectSchema.shape.organizationId,
	refs: z.array(organizationInvitationUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type OrganizationInvitation = z.infer<
	typeof organizationInvitationSelectSchema
>;
export type OrganizationInvitationInsert = z.infer<
	typeof organizationInvitationInsertSchema
>;
export type OrganizationInvitationUpdate = z.infer<
	typeof organizationInvitationUpdateSchema
>;
export type OrganizationInvitationDelete = z.infer<
	typeof organizationInvitationDeleteSchema
>;
