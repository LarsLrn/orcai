import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	recentResourceSchema,
	resourceGrantSchema,
	resourcePrincipalSchema,
	resourceVisibilityDataSchema,
	resourceVisibilityRecordSchema,
} from "./schema";

export const resourceGrantResponseSchema =
	createDataResponseSchema(resourceGrantSchema);

export const resourceListGrantsResponseSchema =
	createListResponseSchema(resourceGrantSchema);

export const resourceListPrincipalsResponseSchema = createListResponseSchema(
	resourcePrincipalSchema,
);

export const resourceSetVisibilityResponseSchema = createDataResponseSchema(
	resourceVisibilityRecordSchema,
);

export const resourceRevokeResponseSchema = statusResponseSchema;

export const resourceGetVisibilityResponseSchema = createDataResponseSchema(
	resourceVisibilityDataSchema,
);

export const resourceListRecentResponseSchema =
	createListResponseSchema(recentResourceSchema);
