import { INSTANCE_ROLES } from "@orcai/core";
import { z } from "zod/v4";
import { sharedSchemas } from "../shared/forms/shared";
import { organizationIdSchema, userIdSchema } from "../shared/ids";
import { paginationInputSchema } from "../shared/pagination";
import { createSortingInputSchema } from "../shared/sorting";
import { uploadFileObjectSchema } from "../storage/schema";
import { tourIdSchema, tourStateSchema } from "./parts/preferences";
import { userFiltersSchema } from "./schema";

const instanceUserSortKeySchema = z.enum([
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

export const resetTwoFactorInputSchema = z.object({
	userId: userIdSchema,
});

export const setInstanceRoleInputSchema = z.object({
	userId: userIdSchema,
	role: z.enum(INSTANCE_ROLES),
});

export const deleteUsersInputSchema = z.object({
	userIds: userIdSchema.array().min(1),
	/** Who receives what the accounts own, per organisation; its earliest admin when left out. */
	receivers: z
		.array(
			z.object({
				organizationId: organizationIdSchema,
				userId: userIdSchema,
			}),
		)
		.default([]),
});

export const meInputSchema = z.object({});

export const updatePasswordInputSchema = z.object({
	currentPassword: sharedSchemas.currentPassword,
	password: sharedSchemas.password,
});

export const setActiveOrganizationInputSchema = z.object({
	organizationId: organizationIdSchema,
});

export const setTourStateInputSchema = z.object({
	tourId: tourIdSchema,
	state: tourStateSchema,
});

/** A cropped picture the caller uploaded through the `profileImage` route. */
export const setUserImageInputSchema = z.object({
	file: uploadFileObjectSchema,
});

export const removeUserImageInputSchema = z.object({});

export type InstanceUserSortKey = z.infer<typeof instanceUserSortKeySchema>;
