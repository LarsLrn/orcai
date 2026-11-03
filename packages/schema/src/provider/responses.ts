import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared/responses";
import { providerDetailSchema, providerSchema } from "./schema";

export const listProvidersResponseSchema =
	createListResponseSchema(providerSchema);

export const findProviderResponseSchema =
	createDataResponseSchema(providerDetailSchema);

export const createProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const updateProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const deleteProviderResponseSchema = createDeleteResponseSchema();
