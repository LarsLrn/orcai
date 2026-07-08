import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
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
