import {
	createOrganizationInputSchema,
	createOrganizationResponseSchema,
	deleteOrganizationsInputSchema,
	deleteOrganizationsResponseSchema,
	findOrganizationInputSchema,
	findOrganizationResponseSchema,
	listAllOrganizationsInputSchema,
	listAllOrganizationsResponseSchema,
	listOrganizationsInputSchema,
	listOrganizationsResponseSchema,
	organizationDeletionImpactInputSchema,
	organizationDeletionImpactResponseSchema,
	removeOrganizationLogoInputSchema,
	removeOrganizationLogoResponseSchema,
	setOrganizationLogoInputSchema,
	setOrganizationLogoResponseSchema,
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
	listAll: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations",
				summary: "List every organization of the instance",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(listAllOrganizationsInputSchema)
		.output(listAllOrganizationsResponseSchema),
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
	setLogo: base
		.meta(
			openapi({
				method: "PUT",
				path: "/organizations/{id}/logo",
				summary: "Set the organisation's logo",
				description:
					"Takes a square WebP of at most 256 KB uploaded through the `organizationLogo` route.",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(setOrganizationLogoInputSchema)
		.output(setOrganizationLogoResponseSchema),
	removeLogo: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/organizations/{id}/logo",
				summary: "Remove the organisation's logo",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(removeOrganizationLogoInputSchema)
		.output(removeOrganizationLogoResponseSchema),
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
	deletionImpact: base
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{id}/deletion-impact",
				summary: "Preview what deleting an organization takes with it",
				tags: [
					"Organizations",
				],
			}),
		)
		.input(organizationDeletionImpactInputSchema)
		.output(organizationDeletionImpactResponseSchema),
};
