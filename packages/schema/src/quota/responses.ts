import { createDataResponseSchema, createListResponseSchema } from "../shared";
import { quotaPoolSchema } from "./schema";
import {
	quotaPoolDetailSchema,
	quotaPoolListRowSchema,
	quotaStatusSchema,
	quotaUsageEventListRowSchema,
} from "./views";

export const quotaPoolListResponseSchema = createListResponseSchema(
	quotaPoolListRowSchema,
);

export const quotaPoolFindResponseSchema = createDataResponseSchema(
	quotaPoolDetailSchema,
);

export const quotaPoolWriteResponseSchema =
	createDataResponseSchema(quotaPoolSchema);

export const quotaStatusResponseSchema =
	createDataResponseSchema(quotaStatusSchema);

export const quotaUsageEventListResponseSchema = createListResponseSchema(
	quotaUsageEventListRowSchema,
);
