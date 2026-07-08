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
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const organizationContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/organizations",
				summary: "List all organizations",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(listOrganizationsInputSchema)
		.output(listOrganizationsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/organizations",
				summary: "Create an organization",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(createOrganizationInputSchema)
		.output(createOrganizationResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{id}",
				summary: "Find an organization",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(findOrganizationInputSchema)
		.output(findOrganizationResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/organizations/{id}",
				summary: "Update an organization",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(updateOrganizationInputSchema)
		.output(updateOrganizationResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/organizations",
				summary: "Delete organizations",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(deleteOrganizationsInputSchema)
		.output(deleteOrganizationsResponseSchema),
};
