import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { organizationMemberSchema } from "./schema";

export const listOrganizationMembersResponseSchema = createListResponseSchema(
	organizationMemberSchema,
);

export const findOrganizationMemberResponseSchema = createDataResponseSchema(
	organizationMemberSchema,
);

export const updateOrganizationMemberResponseSchema = createDataResponseSchema(
	organizationMemberSchema,
);

export const deleteOrganizationMembersResponseSchema =
	createDeleteResponseSchema();
