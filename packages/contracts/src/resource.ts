import {
	listContentReceiversResponseSchema,
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

export const resourceContracts = {
	listGrants: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "List direct grants for a resource",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceListGrantsInputSchema)
		.output(resourceListGrantsResponseSchema),
	inheritedAccess: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/inherited-access",
				summary: "Summarise the access a resource inherits from its ancestors",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceInheritedAccessInputSchema)
		.output(resourceInheritedAccessResponseSchema),
	listPrincipals: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/principals",
				summary: "List principals that can be directly granted on a resource",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceListPrincipalsInputSchema)
		.output(resourceListPrincipalsResponseSchema),
	listRecent: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/recent",
				summary: "List the resources that changed most recently",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceListRecentInputSchema)
		.output(resourceListRecentResponseSchema),
	grant: base
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "Grant direct access to a resource",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceGrantInputSchema)
		.output(resourceGrantResponseSchema),
	revoke: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/resources/{resourceType}/{resourceId}/grants",
				summary: "Revoke direct access from a resource",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceRevokeInputSchema)
		.output(resourceRevokeResponseSchema),
	getVisibility: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/visibility",
				summary: "Get resource visibility",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceGetVisibilityInputSchema)
		.output(resourceGetVisibilityResponseSchema),
	listingImpact: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/listing-impact",
				summary: "What changing a resource's listing involves",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceListingImpactInputSchema)
		.output(resourceListingImpactResponseSchema),
	setVisibility: base
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/visibility",
				summary: "Set resource visibility",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceSetVisibilityInputSchema)
		.output(resourceSetVisibilityResponseSchema),
	receivers: base
		.meta(
			openapi({
				method: "GET",
				path: "/resources/{resourceType}/{resourceId}/receivers",
				summary: "List the members the owner may hand a resource to",
				tags: [
					"Resources",
				],
			}),
		)
		.input(resourceListReceiversInputSchema)
		.output(listContentReceiversResponseSchema),
	handOver: base
		.meta(
			openapi({
				method: "POST",
				path: "/resources/{resourceType}/{resourceId}/hand-over",
				summary: "Hand a resource over to another member",
				tags: [
					"Resources",
				],
				description: "Only the owner; they keep Can manage on it.",
			}),
		)
		.input(resourceHandOverInputSchema)
		.output(resourceHandOverResponseSchema),
};
