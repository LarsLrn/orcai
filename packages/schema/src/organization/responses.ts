import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	organizationDeletionImpactSchema,
	organizationProfileSchema,
	organizationSchema,
	organizationWithMemberCountSchema,
} from "./schema";

export const listOrganizationsResponseSchema =
	createListResponseSchema(organizationSchema);

export const listAllOrganizationsResponseSchema = createListResponseSchema(
	organizationWithMemberCountSchema,
);

export const findOrganizationResponseSchema = createDataResponseSchema(
	organizationWithMemberCountSchema,
);

export const organizationProfileResponseSchema = createDataResponseSchema(
	organizationProfileSchema,
);

export const createOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const updateOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const deleteOrganizationsResponseSchema = createDeleteResponseSchema();

export const organizationDeletionImpactResponseSchema =
	createDataResponseSchema(organizationDeletionImpactSchema);

export const setOrganizationLogoResponseSchema = createDataResponseSchema(
	z.object({
		logo: z.string(),
	}),
);

export const removeOrganizationLogoResponseSchema = statusResponseSchema;
