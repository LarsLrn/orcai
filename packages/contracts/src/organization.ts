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
	organizationProfileInputSchema,
	organizationProfileResponseSchema,
	removeOrganizationLogoInputSchema,
	removeOrganizationLogoResponseSchema,
	setOrganizationLogoInputSchema,
	setOrganizationLogoResponseSchema,
	updateOrganizationInputSchema,
	updateOrganizationResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Organisations",
		],
	}),
);

export const organizationContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/organizations",
				summary: "List all organisations",
			}),
		)
		.input(listOrganizationsInputSchema)
		.output(listOrganizationsResponseSchema),
	listAll: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations",
				summary: "List every organisation of the instance",
			}),
		)
		.input(listAllOrganizationsInputSchema)
		.output(listAllOrganizationsResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/organizations",
				summary: "Create an organisation",
			}),
		)
		.input(createOrganizationInputSchema)
		.output(createOrganizationResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{id}",
				summary: "Find an organisation",
			}),
		)
		.input(findOrganizationInputSchema)
		.output(findOrganizationResponseSchema),
	profile: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{id}/profile",
				summary: "Find an organisation's public profile",
				description:
					"What any signed-in user sees of an organisation: its name, logo, description and how many entries of each kind it lists in the Catalogue.",
			}),
		)
		.input(organizationProfileInputSchema)
		.output(organizationProfileResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/organizations/{id}",
				summary: "Update an organisation",
			}),
		)
		.input(updateOrganizationInputSchema)
		.output(updateOrganizationResponseSchema),
	setLogo: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/organizations/{id}/logo",
				summary: "Set the organisation's logo",
				description:
					"Takes a square WebP of at most 256 KB uploaded through the `organizationLogo` route.",
			}),
		)
		.input(setOrganizationLogoInputSchema)
		.output(setOrganizationLogoResponseSchema),
	removeLogo: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/organizations/{id}/logo",
				summary: "Remove the organisation's logo",
			}),
		)
		.input(removeOrganizationLogoInputSchema)
		.output(removeOrganizationLogoResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/organizations",
				summary: "Delete organisations",
			}),
		)
		.input(deleteOrganizationsInputSchema)
		.output(deleteOrganizationsResponseSchema),
	deletionImpact: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/organizations/{id}/deletion-impact",
				summary: "Preview what deleting an organisation takes with it",
			}),
		)
		.input(organizationDeletionImpactInputSchema)
		.output(organizationDeletionImpactResponseSchema),
};
