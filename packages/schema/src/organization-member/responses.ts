import { handOverActionResponseSchema } from "../ownership/responses";
import { handedOverSchema } from "../ownership/schema";
import { createDataResponseSchema, createListResponseSchema } from "../shared";
import { userWithOrganizationRoleSchema } from "../user/schema";
import { memberAccessEntrySchema, organizationMemberSchema } from "./schema";

export const listOrganizationMembersResponseSchema = createListResponseSchema(
	userWithOrganizationRoleSchema,
);

export const findOrganizationMemberResponseSchema = createDataResponseSchema(
	userWithOrganizationRoleSchema,
);

export const listMemberAccessResponseSchema = createListResponseSchema(
	memberAccessEntrySchema,
);

export const updateOrganizationMemberResponseSchema = createDataResponseSchema(
	organizationMemberSchema,
).extend({
	handedOver: handedOverSchema.nullable(),
});

export const deleteOrganizationMembersResponseSchema =
	handOverActionResponseSchema;
