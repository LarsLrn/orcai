import { z } from "zod/v4";
import { instanceUserSchema } from "../instance/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { userSchema } from "./schema";

export const listAllUsersResponseSchema =
	createListResponseSchema(instanceUserSchema);

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

export const setUserImageResponseSchema = createDataResponseSchema(
	z.object({
		image: z.string(),
	}),
);

export const removeUserImageResponseSchema = statusResponseSchema;
