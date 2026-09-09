import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	inheritedAccessSchema,
	recentResourceSchema,
	resourceGrantSchema,
	resourcePrincipalSchema,
	resourceVisibilityDataSchema,
	resourceVisibilityRecordSchema,
} from "./schema";

export const resourceGrantResponseSchema =
	createListResponseSchema(resourceGrantSchema);

export const resourceListGrantsResponseSchema =
	createListResponseSchema(resourceGrantSchema);

export const resourceInheritedAccessResponseSchema = createDataResponseSchema(
	inheritedAccessSchema,
);

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
