import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { sharedSchemas } from "../zod/shared";
import { userIdSchema } from "./ref";

export const listUsersInputSchema = paginationInputSchema.extend(
	zedTokenSchema.shape,
);

export const findUserInputSchema = z.object({
	id: userIdSchema,
	...zedTokenSchema.shape,
});

export const listUserAccessInputSchema = z.object({
	id: userIdSchema,
	...zedTokenSchema.shape,
});

export const meInputSchema = z.object({
	...zedTokenSchema.shape,
});

export const updatePasswordInputSchema = z.object({
	currentPassword: sharedSchemas.password,
	password: sharedSchemas.password,
});

export const setActiveOrganizationInputSchema = z.object({
	organizationId: organizationIdSchema,
});

export const setTourStateInputSchema = z.object({
	tourId: z.string(),
	state: z.enum([
		"skipped",
		"completed",
		"pending",
	]),
});

export type ListUsersInput = z.infer<typeof listUsersInputSchema>;
export type FindUserInput = z.infer<typeof findUserInputSchema>;
export type ListUserAccessInput = z.infer<typeof listUserAccessInputSchema>;
export type MeInput = z.infer<typeof meInputSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordInputSchema>;
export type SetActiveOrganizationInput = z.infer<
	typeof setActiveOrganizationInputSchema
>;
export type SetTourStateInput = z.infer<typeof setTourStateInputSchema>;
