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
import { base } from "./base";

export const providerContracts = {
	list: base
		.route({
			method: "GET",
			path: "/providers",
			summary: "List all providers",
			tags: [
				"Providers",
			],
		})
		.input(listProvidersInputSchema)
		.output(listProvidersResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/providers",
			summary: "Create a provider",
			tags: [
				"Providers",
			],
		})
		.input(createProviderInputSchema)
		.output(createProviderResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/providers/{id}",
			summary: "Find a provider",
			tags: [
				"Providers",
			],
		})
		.input(findProviderInputSchema)
		.output(findProviderResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/providers/{id}",
			summary: "Update a provider",
			tags: [
				"Providers",
			],
		})
		.input(updateProviderInputSchema)
		.output(updateProviderResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/providers",
			summary: "Delete providers",
			tags: [
				"Providers",
			],
		})
		.input(deleteProviderInputSchema)
		.output(deleteProviderResponseSchema),
};
