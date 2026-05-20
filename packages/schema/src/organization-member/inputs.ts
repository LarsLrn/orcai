import { z } from "zod/v4";
import { paginationInputSchema } from "../shared";
import { userIdSchema } from "../user/ref";
import {
	organizationMemberFieldsSchema,
	organizationMemberMutableFieldsSchema,
	organizationMemberSchema,
} from "./schema";

export const listOrganizationMembersInputSchema = paginationInputSchema.extend({
	organizationId: organizationMemberSchema.shape.organizationId,
});

export const createOrganizationMemberInputSchema =
	organizationMemberFieldsSchema;

export const findOrganizationMemberInputSchema = organizationMemberSchema.pick({
	userId: true,
	organizationId: true,
});

export const updateOrganizationMemberInputSchema =
	organizationMemberMutableFieldsSchema.extend({
		organizationId: organizationMemberSchema.shape.organizationId,
		userId: organizationMemberSchema.shape.userId,
	});

export const deleteOrganizationMembersInputSchema = z.object({
	organizationId: organizationMemberSchema.shape.organizationId,
	refs: z.array(
		z.object({
			userId: userIdSchema,
		}),
	),
});

export type ListOrganizationMembersInput = z.infer<
	typeof listOrganizationMembersInputSchema
>;
export type CreateOrganizationMemberInput = z.infer<
	typeof createOrganizationMemberInputSchema
>;
export type FindOrganizationMemberInput = z.infer<
	typeof findOrganizationMemberInputSchema
>;
export type UpdateOrganizationMemberInput = z.infer<
	typeof updateOrganizationMemberInputSchema
>;
export type DeleteOrganizationMembersInput = z.infer<
	typeof deleteOrganizationMembersInputSchema
>;
