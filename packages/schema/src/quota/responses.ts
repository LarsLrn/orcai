import { createDataResponseSchema, createListResponseSchema } from "../shared";
import { quotaPoolSchema } from "./schema";
import {
	quotaChatBadgeSchema,
	quotaPoolDetailSchema,
	quotaPoolListRowSchema,
} from "./views";

export const quotaPoolListResponseSchema = createListResponseSchema(
	quotaPoolListRowSchema,
);

export const quotaPoolFindResponseSchema = createDataResponseSchema(
	quotaPoolDetailSchema,
);

export const quotaPoolWriteResponseSchema =
	createDataResponseSchema(quotaPoolSchema);

export const quotaChatBadgeResponseSchema =
	createDataResponseSchema(quotaChatBadgeSchema);
