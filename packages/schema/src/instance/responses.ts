import { z } from "zod/v4";
import { organizationWithMemberCountSchema } from "../organization/schema";
import { skippedInviteeSchema } from "../organization-invitation/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared/responses";
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

export const inviteInstanceOrganizationMemberResponseSchema =
	statusResponseSchema.extend({
		skipped: z.array(skippedInviteeSchema),
	});

export const removeInstanceImageResponseSchema = statusResponseSchema;
