import { dbSchema } from "@orcai/db/schema";
import {
	organizationIdSchema,
	organizationInvitationIdSchema,
} from "@orcai/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationInvitationSelectSchema = createSelectSchema(
	dbSchema.invitation,
	{
		id: organizationInvitationIdSchema,
		organizationId: organizationIdSchema,
	},
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationInvitationInsertSchema = z.object({
	organizationId: z
		.string()
		.min(1, "Please select an organization")
		.pipe(organizationIdSchema),
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
					path: [
						"root",
					],
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

export const organizationInvitationUpdateSchema = z
	.object({
		organizationId: organizationInvitationSelectSchema.shape.organizationId,
		id: organizationInvitationSelectSchema.shape.id,
		status: z
			.enum([
				"pending",
				"accepted",
				"rejected",
			])
			.optional(),
		expiresAt: organizationInvitationSelectSchema.shape.expiresAt.optional(),
	})
	.check((ctx) => {
		if (ctx.value.status === undefined && ctx.value.expiresAt === undefined) {
			ctx.issues.push({
				code: "custom",
				message: "At least one mutable field must be provided",
				path: [
					"root",
				],
				input: "",
			});
		}
	});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationInvitationDeleteSchema = z.object({
	organizationId: organizationInvitationSelectSchema.shape.organizationId,
	refs: z.array(
		z.object({
			id: organizationInvitationSelectSchema.shape.id,
		}),
	),
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
