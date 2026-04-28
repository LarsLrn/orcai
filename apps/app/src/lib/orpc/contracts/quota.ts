import { base } from "@orcai/contracts";
import {
	quotaChatBadgeInputSchema,
	quotaChatBadgeResponseSchema,
	quotaPoolCreateInputSchema,
	quotaPoolDeactivateInputSchema,
	quotaPoolFindInputSchema,
	quotaPoolFindResponseSchema,
	quotaPoolListInputSchema,
	quotaPoolListResponseSchema,
	quotaPoolUpdateInputSchema,
	quotaPoolWriteResponseSchema,
} from "@/lib/orpc/schemas/quota";

export const listQuotaPoolsContract = base
	.route({
		method: "GET",
		path: "/quota-pools",
		summary: "List quota pools",
		tags: [
			"Quota",
		],
	})
	.input(quotaPoolListInputSchema)
	.output(quotaPoolListResponseSchema);

export const createQuotaPoolContract = base
	.route({
		method: "POST",
		path: "/quota-pools",
		summary: "Create quota pool",
		tags: [
			"Quota",
		],
	})
	.input(quotaPoolCreateInputSchema)
	.output(quotaPoolWriteResponseSchema);

export const findQuotaPoolContract = base
	.route({
		method: "GET",
		path: "/quota-pools/{id}",
		summary: "Find quota pool",
		tags: [
			"Quota",
		],
	})
	.input(quotaPoolFindInputSchema)
	.output(quotaPoolFindResponseSchema);

export const updateQuotaPoolContract = base
	.route({
		method: "PUT",
		path: "/quota-pools/{id}",
		summary: "Update quota pool",
		tags: [
			"Quota",
		],
	})
	.input(quotaPoolUpdateInputSchema)
	.output(quotaPoolWriteResponseSchema);

export const deactivateQuotaPoolContract = base
	.route({
		method: "POST",
		path: "/quota-pools/{id}/deactivate",
		summary: "Deactivate quota pool",
		tags: [
			"Quota",
		],
	})
	.input(quotaPoolDeactivateInputSchema)
	.output(quotaPoolWriteResponseSchema);

export const quotaChatBadgeContract = base
	.route({
		method: "POST",
		path: "/quota/chat-badge",
		summary: "Get remaining quota for chat header badge",
		tags: [
			"Quota",
		],
	})
	.input(quotaChatBadgeInputSchema)
	.output(quotaChatBadgeResponseSchema);
