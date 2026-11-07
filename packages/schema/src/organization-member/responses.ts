import { handOverActionResponseSchema } from "../ownership/responses";
import { handedOverSchema } from "../ownership/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
} from "../shared/responses";
import {
	memberAccessEntrySchema,
	organizationMemberSchema,
	organizationMemberUserSchema,
} from "./schema";

export const listOrganizationMembersResponseSchema = createListResponseSchema(
	organizationMemberUserSchema,
);

export const findOrganizationMemberResponseSchema = createDataResponseSchema(
	organizationMemberUserSchema,
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
