import { z } from "zod/v4";
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

export const findUserResponseSchema = createDataResponseSchema(
	userWithOrganizationRoleSchema,
);

export const listUserAccessResponseSchema = createListResponseSchema(
	userAccessEntrySchema,
);

export const deleteUsersResponseSchema = statusResponseSchema.extend({
	deletedCount: z.number(),
});

export const meResponseSchema = createDataResponseSchema(userSchema);

export const updatePasswordResponseSchema = statusResponseSchema;

export const setActiveOrganizationResponseSchema = statusResponseSchema;

export const setTourStateResponseSchema = statusResponseSchema;
