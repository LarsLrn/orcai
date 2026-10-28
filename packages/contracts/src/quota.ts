import {
	quotaPoolCreateInputSchema,
	quotaPoolDeactivateInputSchema,
	quotaPoolFindInputSchema,
	quotaPoolFindResponseSchema,
	quotaPoolListInputSchema,
	quotaPoolListResponseSchema,
	quotaPoolUpdateInputSchema,
	quotaPoolWriteResponseSchema,
	quotaStatusInputSchema,
	quotaStatusResponseSchema,
	quotaUsageEventListInputSchema,
	quotaUsageEventListResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const quotaContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools",
				summary: "List quota pools",
				tags: [
					"Quota",
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
					"Quota",
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
					"Quota",
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
					"Quota",
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
					"Quota",
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
					"Quota",
				],
			}),
		)
		.input(quotaPoolDeactivateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	status: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota/status",
				summary: "Get the quota pool covering the user for a model",
				tags: [
					"Quota",
				],
			}),
		)
		.input(quotaStatusInputSchema)
		.output(quotaStatusResponseSchema),
};
