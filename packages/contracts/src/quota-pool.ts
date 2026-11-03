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

const tagged = base.meta(
	openapi({
		tags: [
			"Quota pools",
		],
	}),
);

export const quotaPoolContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools",
				summary: "List quota pools",
			}),
		)
		.input(quotaPoolListInputSchema)
		.output(quotaPoolListResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/quota-pools",
				summary: "Create quota pool",
			}),
		)
		.input(quotaPoolCreateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools/{id}",
				summary: "Find quota pool",
			}),
		)
		.input(quotaPoolFindInputSchema)
		.output(quotaPoolFindResponseSchema),
	listEvents: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/quota-pools/{quotaPoolId}/events",
				summary: "List quota pool usage events",
			}),
		)
		.input(quotaUsageEventListInputSchema)
		.output(quotaUsageEventListResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/quota-pools/{id}",
				summary: "Update quota pool",
			}),
		)
		.input(quotaPoolUpdateInputSchema)
		.output(quotaPoolWriteResponseSchema),
	deactivate: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/quota-pools/{id}/deactivate",
				summary: "Deactivate quota pool",
			}),
		)
		.input(quotaPoolDeactivateInputSchema)
		.output(quotaPoolWriteResponseSchema),
};
