import { organizationWithMemberCountSchema } from "../organization/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	instanceOrganizationMemberSchema,
	instanceUserMembershipSchema,
	instanceUserSchema,
} from "./schema";

export const findInstanceUserResponseSchema =
	createDataResponseSchema(instanceUserSchema);

export const listInstanceUserMembershipsResponseSchema =
	createListResponseSchema(instanceUserMembershipSchema);

export const findInstanceOrganizationResponseSchema = createDataResponseSchema(
	organizationWithMemberCountSchema,
);

export const listInstanceOrganizationMembersResponseSchema =
	createListResponseSchema(instanceOrganizationMemberSchema);

export const instanceMembershipActionResponseSchema = statusResponseSchema;
