import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import {
	organizationDeletionImpactSchema,
	organizationSchema,
	organizationWithMemberCountSchema,
} from "./schema";

export const listOrganizationsResponseSchema =
	createListResponseSchema(organizationSchema);

export const listAllOrganizationsResponseSchema = createListResponseSchema(
	organizationWithMemberCountSchema,
);

export const findOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const createOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const updateOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const deleteOrganizationsResponseSchema = createDeleteResponseSchema();

export const organizationDeletionImpactResponseSchema =
	createDataResponseSchema(organizationDeletionImpactSchema);
