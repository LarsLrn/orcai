import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { organizationIdSchema } from "../organization/ref";
import { paginationInputSchema } from "../shared";
import { localeSchema } from "../shared/primitives/locale";
import { createSortingInputSchema } from "../shared/sorting";
import { userIdSchema } from "../user/ref";

export const findInstanceUserInputSchema = z.object({
	id: userIdSchema,
});

export const instanceUserMembershipSortKeySchema = z.enum([
	"name",
	"role",
	"joinedAt",
]);

export const listInstanceUserMembershipsInputSchema =
	paginationInputSchema.extend({
		userId: userIdSchema,
		query: z.string().trim().max(200).optional(),
		...createSortingInputSchema(instanceUserMembershipSortKeySchema).shape,
	});

export const findInstanceOrganizationInputSchema = z.object({
	id: organizationIdSchema,
});

export const instanceOrganizationMemberSortKeySchema = z.enum([
	"name",
	"email",
	"role",
	"joinedAt",
]);

export const listInstanceOrganizationMembersInputSchema =
	paginationInputSchema.extend({
		organizationId: organizationIdSchema,
		query: z.string().trim().max(200).optional(),
		...createSortingInputSchema(instanceOrganizationMemberSortKeySchema).shape,
	});

export const findInstanceOrganizationReadinessInputSchema = z.object({
	organizationId: organizationIdSchema,
});

export const addInstanceOrganizationMemberInputSchema = z.object({
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	role: organizationRoleSchema,
});

export const updateInstanceOrganizationMemberInputSchema = z.object({
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	role: organizationRoleSchema,
	/** Who receives what a member made a Viewer owns; the acting admin when left out and eligible. */
	receiverId: userIdSchema.optional(),
});

export const removeInstanceOrganizationMemberInputSchema = z.object({
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	/** Who receives what the removed member owns; the acting admin when left out and eligible. */
	receiverId: userIdSchema.optional(),
});

export const removeInstanceUserImageInputSchema = z.object({
	id: userIdSchema,
});

export const removeInstanceOrganizationLogoInputSchema = z.object({
	id: organizationIdSchema,
});

export const inviteInstanceOrganizationMemberInputSchema = z.object({
	organizationId: organizationIdSchema,
	email: z.email(),
	role: organizationRoleSchema,
	/** Language of the invitation email. */
	locale: localeSchema.optional(),
});

export type InstanceUserMembershipSortKey = z.infer<
	typeof instanceUserMembershipSortKeySchema
>;
export type InstanceOrganizationMemberSortKey = z.infer<
	typeof instanceOrganizationMemberSortKeySchema
>;
export type ListInstanceUserMembershipsInput = z.infer<
	typeof listInstanceUserMembershipsInputSchema
>;
export type ListInstanceOrganizationMembersInput = z.infer<
	typeof listInstanceOrganizationMembersInputSchema
>;
