import { z } from "zod/v4";
import { quotaPoolSchema } from "./schema";
import {
	quotaChatBadgeSchema,
	quotaPoolDetailSchema,
	quotaPoolListRowSchema,
} from "./views";

export const quotaPoolListResponseSchema = z.object({
	data: z.array(quotaPoolListRowSchema),
	rowCount: z.number(),
});

export const quotaPoolFindResponseSchema = z.object({
	data: quotaPoolDetailSchema,
});

export const quotaPoolWriteResponseSchema = z.object({
	data: quotaPoolSchema,
});

export const quotaChatBadgeResponseSchema = z.object({
	data: quotaChatBadgeSchema,
});
