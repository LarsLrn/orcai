import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { groupIdSchema } from "../group/ref";
import { paginationInputSchema } from "../shared";
import { quotaPoolIdSchema } from "./ref";
import {
	quotaPoolFieldsSchema,
	quotaPoolFiltersSchema,
	quotaPoolMutableFieldsSchema,
} from "./schema";

export const quotaPoolListInputSchema = paginationInputSchema.extend({
	filters: quotaPoolFiltersSchema.optional(),
});

export const quotaPoolCreateInputSchema = quotaPoolFieldsSchema.extend({
	groupIds: z.array(groupIdSchema).min(1).max(500),
});

export const quotaPoolUpdateInputSchema = quotaPoolMutableFieldsSchema.extend({
	id: quotaPoolIdSchema,
	groupIds: z.array(groupIdSchema).min(1).max(500).optional(),
});

export const quotaPoolDeactivateInputSchema = z.object({
	id: quotaPoolIdSchema,
});

export const quotaPoolFindInputSchema = z.object({
	id: quotaPoolIdSchema,
});

export const quotaChatBadgeInputSchema = z.object({
	chatId: chatIdSchema,
});

export type QuotaPoolListInput = z.infer<typeof quotaPoolListInputSchema>;
export type QuotaPoolCreateInput = z.infer<typeof quotaPoolCreateInputSchema>;
export type QuotaPoolUpdateInput = z.infer<typeof quotaPoolUpdateInputSchema>;
export type QuotaPoolDeactivateInput = z.infer<
	typeof quotaPoolDeactivateInputSchema
>;
export type QuotaPoolFindInput = z.infer<typeof quotaPoolFindInputSchema>;
export type QuotaChatBadgeInput = z.infer<typeof quotaChatBadgeInputSchema>;
