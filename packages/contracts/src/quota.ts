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
} from "@orcai/schema";
import { base } from "./base";

export const quotaContracts = {
	list: base
		.route({
			method: "GET",
			path: "/quota-pools",
			summary: "List quota pools",
			tags: [
				"Quota",
			],
		})
		.input(quotaPoolListInputSchema)
		.output(quotaPoolListResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/quota-pools",
			summary: "Create quota pool",
			tags: [
				"Quota",
			],
		})
		.input(quotaPoolCreateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/quota-pools/{id}",
			summary: "Find quota pool",
			tags: [
				"Quota",
			],
		})
		.input(quotaPoolFindInputSchema)
		.output(quotaPoolFindResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/quota-pools/{id}",
			summary: "Update quota pool",
			tags: [
				"Quota",
			],
		})
		.input(quotaPoolUpdateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	deactivate: base
		.route({
			method: "POST",
			path: "/quota-pools/{id}/deactivate",
			summary: "Deactivate quota pool",
			tags: [
				"Quota",
			],
		})
		.input(quotaPoolDeactivateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	chatBadge: base
		.route({
			method: "POST",
			path: "/quota/chat-badge",
			summary: "Get remaining quota for chat header badge",
			tags: [
				"Quota",
			],
		})
		.input(quotaChatBadgeInputSchema)
		.output(quotaChatBadgeResponseSchema),
};
