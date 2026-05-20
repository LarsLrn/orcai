import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	zedTokenSchema,
} from "../shared";
import { providerSchema } from "./schema";

export const listProvidersResponseSchema =
	createListResponseSchema(providerSchema);

export const findProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const createProviderResponseSchema = createDataResponseSchema(
	providerSchema,
).extend({
	meta: zedTokenSchema.optional(),
});

export const updateProviderResponseSchema =
	createDataResponseSchema(providerSchema);

export const deleteProviderResponseSchema = createDeleteResponseSchema();
