import {
	createProviderInputSchema,
	createProviderResponseSchema,
	deleteProviderInputSchema,
	deleteProviderResponseSchema,
	findProviderInputSchema,
	findProviderResponseSchema,
	listProvidersInputSchema,
	listProvidersResponseSchema,
	updateProviderInputSchema,
	updateProviderResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Providers",
		],
	}),
);

export const providerContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/providers",
				summary: "List all providers",
			}),
		)
		.input(listProvidersInputSchema)
		.output(listProvidersResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/providers",
				summary: "Create a provider",
			}),
		)
		.input(createProviderInputSchema)
		.output(createProviderResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/providers/{id}",
				summary: "Find a provider",
			}),
		)
		.input(findProviderInputSchema)
		.output(findProviderResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/providers/{id}",
				summary: "Update a provider",
			}),
		)
		.input(updateProviderInputSchema)
		.output(updateProviderResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/providers",
				summary: "Delete providers",
			}),
		)
		.input(deleteProviderInputSchema)
		.output(deleteProviderResponseSchema),
};
