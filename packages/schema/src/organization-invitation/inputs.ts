import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { paginationInputSchema } from "../shared";
import type { ErrorReason } from "../shared/error-reason";
import { localeSchema } from "../shared/primitives/locale";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { organizationInvitationResponseActionSchema } from "./parts/response-action";
import { organizationInvitationIdSchema } from "./ref";
import {
	organizationInvitationFiltersSchema,
	organizationInvitationMutableFieldsSchema,
	organizationInvitationSchema,
} from "./schema";

export const organizationInvitationSortKeySchema = z.enum([
	"email",
	"id",
	"expiresAt",
	"status",
	"role",
	"createdAt",
]);

export const listOrganizationInvitationsInputSchema =
	paginationInputSchema.extend({
		organizationId: organizationIdSchema.optional(),
		filters: organizationInvitationFiltersSchema.optional(),
		...createSortingInputSchema(organizationInvitationSortKeySchema).shape,
	});

export const createOrganizationInvitationsInputSchema = z.object({
	organizationId: z.string().min(1).pipe(organizationIdSchema),
	role: organizationInvitationSchema.shape.role,
	expiresAt: z.date(),
	/** Language of the invitation emails. */
	locale: localeSchema.optional(),
	items: z
		.array(
			z.object({
				email: z.email(),
			}),
		)
		.min(1)
		.max(200)
		.check((ctx) => {
			const emails = ctx.value.map((item) => item.email.toLowerCase());
			const uniqueEmails = new Set(emails);

			if (uniqueEmails.size !== emails.length) {
				ctx.issues.push({
					code: "custom",
					params: {
						reason: "ITEMS_NOT_UNIQUE" satisfies ErrorReason,
					},
					path: [
						"root",
					],
					input: "",
				});
			}
		}),
});

export const findOrganizationInvitationInputSchema =
	organizationInvitationSchema.pick({
		id: true,
	});

export const validateOrganizationInvitationInputSchema =
	organizationInvitationSchema.pick({
		id: true,
	});

export const updateOrganizationInvitationInputSchema =
	organizationInvitationMutableFieldsSchema
		.extend({
			organizationId: organizationInvitationSchema.shape.organizationId,
			id: organizationInvitationSchema.shape.id,
			expiresAt: z.date().optional(),
		})
		.check((ctx) => {
			if (ctx.value.status === undefined && ctx.value.expiresAt === undefined) {
				ctx.issues.push({
					code: "custom",
					params: {
						reason: "MUTABLE_FIELD_REQUIRED" satisfies ErrorReason,
					},
					path: [
						"root",
					],
					input: "",
				});
			}
		});

export const deleteOrganizationInvitationsInputSchema = z.object({
	organizationId: organizationInvitationSchema.shape.organizationId,
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: organizationInvitationIdSchema,
	}),
});

export const respondToOrganizationInvitationInputSchema = z.object({
	id: organizationInvitationIdSchema,
	response: organizationInvitationResponseActionSchema,
});

export type ListOrganizationInvitationsInput = z.infer<
	typeof listOrganizationInvitationsInputSchema
>;
export type OrganizationInvitationSortKey = z.infer<
	typeof organizationInvitationSortKeySchema
>;
export type CreateOrganizationInvitationsInput = z.infer<
	typeof createOrganizationInvitationsInputSchema
>;
export type FindOrganizationInvitationInput = z.infer<
	typeof findOrganizationInvitationInputSchema
>;
export type ValidateOrganizationInvitationInput = z.infer<
	typeof validateOrganizationInvitationInputSchema
>;
export type UpdateOrganizationInvitationInput = z.infer<
	typeof updateOrganizationInvitationInputSchema
>;
export type DeleteOrganizationInvitationsInput = z.infer<
	typeof deleteOrganizationInvitationsInputSchema
>;
export type RespondToOrganizationInvitationInput = z.infer<
	typeof respondToOrganizationInvitationInputSchema
>;
