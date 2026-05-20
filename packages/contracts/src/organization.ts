import {
	createOrganizationInputSchema,
	createOrganizationResponseSchema,
	deleteOrganizationsInputSchema,
	deleteOrganizationsResponseSchema,
	findOrganizationInputSchema,
	findOrganizationResponseSchema,
	listOrganizationsInputSchema,
	listOrganizationsResponseSchema,
	updateOrganizationInputSchema,
	updateOrganizationResponseSchema,
} from "@orcai/schema";
import { base } from "./base";

export const organizationContracts = {
	list: base
		.route({
			method: "GET",
			path: "/organizations",
			summary: "List all organizations",
			tags: [
				"Organizations",
			],
		})
		.input(listOrganizationsInputSchema)
		.output(listOrganizationsResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/organizations",
			summary: "Create an organization",
			tags: [
				"Organizations",
			],
		})
		.input(createOrganizationInputSchema)
		.output(createOrganizationResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/organizations/{id}",
			summary: "Find an organization",
			tags: [
				"Organizations",
			],
		})
		.input(findOrganizationInputSchema)
		.output(findOrganizationResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/organizations/{id}",
			summary: "Update an organization",
			tags: [
				"Organizations",
			],
		})
		.input(updateOrganizationInputSchema)
		.output(updateOrganizationResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/organizations",
			summary: "Delete organizations",
			tags: [
				"Organizations",
			],
		})
		.input(deleteOrganizationsInputSchema)
		.output(deleteOrganizationsResponseSchema),
};
