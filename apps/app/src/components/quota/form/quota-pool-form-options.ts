import { groupIdSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";
import type { quotaPoolFindResponseSchema } from "@/lib/orpc/schemas/quota";

/**
 * Only used in the UI. Backend stores null.
 */
export const PROVIDER_WIDE_MODEL_VALUE = "__provider_wide__";

export type QuotaPoolDetail = z.infer<
	typeof quotaPoolFindResponseSchema
>["data"];

export const quotaPoolFormSchema = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(1000),
	providerId: z.string().min(1),
	providerModelId: z.string().min(1),
	periodType: z.enum([
		"weekly",
		"monthly",
		"yearly",
	]),
	budgetAmount: z.number().int().positive(),
	priority: z.number().int(),
	isDefault: z.boolean(),
	isActive: z.boolean(),
	groupIds: z.array(groupIdSchema).min(1),
});

const defaultValues = (pool?: QuotaPoolDetail) => ({
	name: pool?.name ?? "",
	description: pool?.description ?? "",
	providerId: pool?.providerId ?? "",
	providerModelId: pool?.providerModelId ?? PROVIDER_WIDE_MODEL_VALUE,
	periodType:
		pool?.periodType ?? ("monthly" as "weekly" | "monthly" | "yearly"),
	budgetAmount: pool?.budgetAmount ?? 100000,
	priority: pool?.priority ?? 0,
	isDefault: pool?.isDefault ?? false,
	isActive: pool?.isActive ?? true,
	groupIds:
		pool?.assignments.map((assignment) => String(assignment.groupId)) ?? [],
});

export const quotaPoolFormOptions = (pool?: QuotaPoolDetail) =>
	formOptions({
		defaultValues: defaultValues(pool),
		validators: {
			onChange: quotaPoolFormSchema,
		},
	});
