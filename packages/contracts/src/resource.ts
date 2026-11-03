import {
	listContentReceiversResponseSchema,
	resourceFindManyInputSchema,
	resourceFindManyResponseSchema,
	resourceGetVisibilityInputSchema,
	resourceGetVisibilityResponseSchema,
	resourceGrantInputSchema,
	resourceGrantResponseSchema,
	resourceHandOverInputSchema,
	resourceHandOverResponseSchema,
	resourceInheritedAccessInputSchema,
	resourceInheritedAccessResponseSchema,
	resourceListGrantsInputSchema,
	resourceListGrantsResponseSchema,
	resourceListingImpactInputSchema,
	resourceListingImpactResponseSchema,
	resourceListPrincipalsInputSchema,
	resourceListPrincipalsResponseSchema,
	resourceListReceiversInputSchema,
	resourceListRecentInputSchema,
	resourceListRecentResponseSchema,
	resourceRevokeInputSchema,
	resourceRevokeResponseSchema,
	resourceSetVisibilityInputSchema,
	resourceSetVisibilityResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Items",
		],
	}),
);

export const resourceContracts = {
	listGrants: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "List the direct grants on an item",
			}),
		)
		.input(resourceListGrantsInputSchema)
		.output(resourceListGrantsResponseSchema),
	inheritedAccess: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/inherited-access",
				summary: "Summarise the access an item inherits",
			}),
		)
		.input(resourceInheritedAccessInputSchema)
		.output(resourceInheritedAccessResponseSchema),
	listPrincipals: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/principals",
				summary:
					"List the people and groups that can get a direct grant on an item",
			}),
		)
		.input(resourceListPrincipalsInputSchema)
		.output(resourceListPrincipalsResponseSchema),
	findMany: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/resources/find",
				summary:
					"Find the given items the user can read, with their current names",
			}),
		)
		.input(resourceFindManyInputSchema)
		.output(resourceFindManyResponseSchema),
	listRecent: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/recent",
				summary: "List the items that changed most recently",
			}),
		)
		.input(resourceListRecentInputSchema)
		.output(resourceListRecentResponseSchema),
	grant: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "Grant direct access to an item",
			}),
		)
		.input(resourceGrantInputSchema)
		.output(resourceGrantResponseSchema),
	revoke: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "Revoke direct access from an item",
			}),
		)
		.input(resourceRevokeInputSchema)
		.output(resourceRevokeResponseSchema),
	getVisibility: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/visibility",
				summary: "Get an item's visibility",
			}),
		)
		.input(resourceGetVisibilityInputSchema)
		.output(resourceGetVisibilityResponseSchema),
	listingImpact: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/listing-impact",
				summary: "What changing an item's listing involves",
			}),
		)
		.input(resourceListingImpactInputSchema)
		.output(resourceListingImpactResponseSchema),
	setVisibility: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/visibility",
				summary: "Set an item's visibility",
			}),
		)
		.input(resourceSetVisibilityInputSchema)
		.output(resourceSetVisibilityResponseSchema),
	receivers: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/receivers",
				summary: "List the members the owner may hand an item over to",
			}),
		)
		.input(resourceListReceiversInputSchema)
		.output(listContentReceiversResponseSchema),
	handOver: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/hand-over",
				summary: "Hand an item over to another member",
				description: "Only the owner; they keep Can manage on it.",
			}),
		)
		.input(resourceHandOverInputSchema)
		.output(resourceHandOverResponseSchema),
};
