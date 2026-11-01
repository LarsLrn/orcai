import {
	quotaPoolCreateInputSchema,
	quotaPoolDeactivateInputSchema,
	quotaPoolFindInputSchema,
	quotaPoolFindResponseSchema,
	quotaPoolListInputSchema,
	quotaPoolListResponseSchema,
	quotaPoolUpdateInputSchema,
	quotaPoolWriteResponseSchema,
	quotaUsageEventListInputSchema,
	quotaUsageEventListResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const quotaPoolContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools",
				summary: "List quota pools",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaPoolListInputSchema)
		.output(quotaPoolListResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/quota-pools",
				summary: "Create quota pool",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaPoolCreateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools/{id}",
				summary: "Find quota pool",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaPoolFindInputSchema)
		.output(quotaPoolFindResponseSchema),
	listEvents: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools/{quotaPoolId}/events",
				summary: "List quota pool usage events",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaUsageEventListInputSchema)
		.output(quotaUsageEventListResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/quota-pools/{id}",
				summary: "Update quota pool",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaPoolUpdateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	deactivate: base
		.meta(
			openapi({
				method: "POST",
				path: "/quota-pools/{id}/deactivate",
				summary: "Deactivate quota pool",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaPoolDeactivateInputSchema)
		.output(quotaPoolWriteResponseSchema),
};
