import { z } from "zod/v4";
import { instanceUserSchema } from "../instance/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	userAccessEntrySchema,
	userSchema,
	userWithOrganizationRoleSchema,
} from "./schema";

export const listUsersResponseSchema = createListResponseSchema(
	userWithOrganizationRoleSchema,
);

export const listAllUsersResponseSchema =
	createListResponseSchema(instanceUserSchema);

export const findUserResponseSchema = createDataResponseSchema(
	userWithOrganizationRoleSchema,
);

export const listUserAccessResponseSchema = createListResponseSchema(
	userAccessEntrySchema,
);

export const deleteUsersResponseSchema = statusResponseSchema.extend({
	deletedCount: z.number(),
});

export const banUserResponseSchema = statusResponseSchema;

export const unbanUserResponseSchema = statusResponseSchema;

export const resetTwoFactorResponseSchema = statusResponseSchema;

export const setInstanceRoleResponseSchema = statusResponseSchema;

export const meResponseSchema = createDataResponseSchema(userSchema);

export const updatePasswordResponseSchema = statusResponseSchema;

export const setActiveOrganizationResponseSchema = statusResponseSchema;

export const setTourStateResponseSchema = statusResponseSchema;
