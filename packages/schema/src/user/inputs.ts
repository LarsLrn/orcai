import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { sharedSchemas } from "../shared/forms/shared";
import { createSortingInputSchema } from "../shared/sorting";
import { userIdSchema } from "./ref";
import { userFiltersSchema } from "./schema";

export const userSortKeySchema = z.enum([
	"name",
	"email",
	"organizationRole",
	"createdAt",
]);

export const listUsersInputSchema = paginationInputSchema.extend({
	filters: userFiltersSchema.optional(),
	...zedTokenSchema.shape,
	...createSortingInputSchema(userSortKeySchema).shape,
});

export const instanceUserSortKeySchema = z.enum([
	"name",
	"email",
	"createdAt",
]);

export const listAllUsersInputSchema = paginationInputSchema.extend({
	filters: userFiltersSchema.optional(),
	...createSortingInputSchema(instanceUserSortKeySchema).shape,
});

export const banUserInputSchema = z.object({
	userId: userIdSchema,
	reason: z.string().trim().max(500).optional(),
});

export const unbanUserInputSchema = z.object({
	userId: userIdSchema,
});

export const findUserInputSchema = z.object({
	id: userIdSchema,
	...zedTokenSchema.shape,
});

export const listUserAccessInputSchema = z.object({
	id: userIdSchema,
	...zedTokenSchema.shape,
});

export const deleteUsersInputSchema = z.object({
	userIds: userIdSchema.array().min(1),
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
export type UserSortKey = z.infer<typeof userSortKeySchema>;
export type ListAllUsersInput = z.infer<typeof listAllUsersInputSchema>;
export type InstanceUserSortKey = z.infer<typeof instanceUserSortKeySchema>;
export type BanUserInput = z.infer<typeof banUserInputSchema>;
export type UnbanUserInput = z.infer<typeof unbanUserInputSchema>;
export type FindUserInput = z.infer<typeof findUserInputSchema>;
export type ListUserAccessInput = z.infer<typeof listUserAccessInputSchema>;
export type DeleteUsersInput = z.infer<typeof deleteUsersInputSchema>;
export type MeInput = z.infer<typeof meInputSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordInputSchema>;
export type SetActiveOrganizationInput = z.infer<
	typeof setActiveOrganizationInputSchema
>;
export type SetTourStateInput = z.infer<typeof setTourStateInputSchema>;
