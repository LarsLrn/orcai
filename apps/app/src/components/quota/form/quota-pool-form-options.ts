import {
	modelIdSchema,
	type QuotaPoolDetail,
	quotaPoolCreateInputSchema,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

/**
 * Only used in the UI. Backend stores null.
 */
export const PROVIDER_WIDE_MODEL_VALUE = "__provider_wide__";

export const quotaPoolFormSchema = quotaPoolCreateInputSchema
	.omit({
		description: true,
		providerModelId: true,
	})
	.extend({
		description: z.string().trim().max(1000),
		providerModelId: z.union([
			modelIdSchema,
			z.literal(PROVIDER_WIDE_MODEL_VALUE),
		]),
	});

const defaultValues = (
	pool?: QuotaPoolDetail,
): z.input<typeof quotaPoolFormSchema> => ({
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
