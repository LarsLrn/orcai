import { z } from "zod/v4";
import { paginationInputSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { userIdSchema } from "../user/ref";
import {
	organizationMemberMutableFieldsSchema,
	organizationMemberSchema,
} from "./schema";

export const listOrganizationMembersInputSchema = paginationInputSchema;

export const findOrganizationMemberInputSchema = organizationMemberSchema.pick({
	userId: true,
});

export const updateOrganizationMemberInputSchema =
	organizationMemberMutableFieldsSchema.extend({
		userId: organizationMemberSchema.shape.userId,
	});

export const deleteOrganizationMembersInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "userId",
		value: userIdSchema,
	}),
});

export type ListOrganizationMembersInput = z.infer<
	typeof listOrganizationMembersInputSchema
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
