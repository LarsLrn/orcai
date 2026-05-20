import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { organizationSchema } from "./schema";

export const listOrganizationsResponseSchema =
	createListResponseSchema(organizationSchema);

export const findOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const createOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const updateOrganizationResponseSchema =
	createDataResponseSchema(organizationSchema);

export const deleteOrganizationsResponseSchema = createDeleteResponseSchema();
