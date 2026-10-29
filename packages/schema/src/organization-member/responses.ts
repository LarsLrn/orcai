import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
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
);

export const deleteOrganizationMembersResponseSchema =
	createDeleteResponseSchema();
