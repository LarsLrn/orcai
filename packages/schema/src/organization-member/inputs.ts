import { z } from "zod/v4";
import { resourceTypeSchema } from "../resource/schema";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { userIdSchema } from "../user/ref";
import { userFiltersSchema } from "../user/schema";
import {
	memberAccessOriginSchema,
	organizationMemberMutableFieldsSchema,
	organizationMemberSchema,
} from "./schema";

export const organizationMemberSortKeySchema = z.enum([
	"name",
	"email",
	"organizationRole",
	"createdAt",
]);

export const listOrganizationMembersInputSchema = paginationInputSchema.extend({
	filters: userFiltersSchema.optional(),
	...zedTokenSchema.shape,
	...createSortingInputSchema(organizationMemberSortKeySchema).shape,
});

export const findOrganizationMemberInputSchema = organizationMemberSchema
	.pick({
		userId: true,
	})
	.extend(zedTokenSchema.shape);

export const memberAccessSortKeySchema = z.enum([
	"resourceName",
	"resourceType",
	"origin",
]);

export const listMemberAccessInputSchema = paginationInputSchema.extend({
	userId: userIdSchema,
	filters: z
		.object({
			search: z.string().trim().max(200).optional(),
			resourceType: resourceTypeSchema.optional(),
			origin: memberAccessOriginSchema.optional(),
		})
		.optional(),
	...createSortingInputSchema(memberAccessSortKeySchema).shape,
	...zedTokenSchema.shape,
});

/** Who receives what a member made a Viewer or removed owns; the acting member when left out and eligible. */
const receiverIdSchema = userIdSchema.optional();

export const updateOrganizationMemberInputSchema =
	organizationMemberMutableFieldsSchema.extend({
		userId: organizationMemberSchema.shape.userId,
		receiverId: receiverIdSchema,
	});

export const deleteOrganizationMembersInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "userId",
		value: userIdSchema,
	}),
	receiverId: receiverIdSchema,
});

export type ListOrganizationMembersInput = z.infer<
	typeof listOrganizationMembersInputSchema
>;
export type OrganizationMemberSortKey = z.infer<
	typeof organizationMemberSortKeySchema
>;
export type FindOrganizationMemberInput = z.infer<
	typeof findOrganizationMemberInputSchema
>;
export type ListMemberAccessInput = z.infer<typeof listMemberAccessInputSchema>;
export type MemberAccessSortKey = z.infer<typeof memberAccessSortKeySchema>;
export type UpdateOrganizationMemberInput = z.infer<
	typeof updateOrganizationMemberInputSchema
>;
export type DeleteOrganizationMembersInput = z.infer<
	typeof deleteOrganizationMembersInputSchema
>;
