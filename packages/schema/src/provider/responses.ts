import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { providerSchema } from "./schema";

export const listProvidersResponseSchema =
	createListResponseSchema(providerSchema);

export const findProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const createProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const updateProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const deleteProviderResponseSchema = createDeleteResponseSchema();
