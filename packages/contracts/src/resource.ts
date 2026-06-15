import {
	resourceGetVisibilityInputSchema,
	resourceGetVisibilityResponseSchema,
	resourceGrantInputSchema,
	resourceGrantResponseSchema,
	resourceListGrantsInputSchema,
	resourceListGrantsResponseSchema,
	resourceListPrincipalsInputSchema,
	resourceListPrincipalsResponseSchema,
	resourceRevokeInputSchema,
	resourceRevokeResponseSchema,
	resourceSetVisibilityInputSchema,
	resourceSetVisibilityResponseSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { base } from "./base";

export const resourceContracts = {
	listGrants: base
		.route({
			method: "GET",
			path: "/resources/{resourceType}/{resourceId}/grants",
			summary: "List direct grants for a resource",
			tags: [
				"Resources",
			],
		})
		.input(resourceListGrantsInputSchema)
		.output(resourceListGrantsResponseSchema),
	listPrincipals: base
		.route({
			method: "GET",
			path: "/resources/{resourceType}/{resourceId}/principals",
			summary: "List principals that can be directly granted on a resource",
			tags: [
				"Resources",
			],
		})
		.input(resourceListPrincipalsInputSchema)
		.output(resourceListPrincipalsResponseSchema),
	grant: base
		.route({
			method: "POST",
			path: "/resources/{resourceType}/{resourceId}/grants",
			summary: "Grant direct access to a resource",
			tags: [
				"Resources",
			],
		})
		.input(resourceGrantInputSchema)
		.output(
			resourceGrantResponseSchema.extend({
				meta: zedTokenSchema.optional(),
			}),
		),
	revoke: base
		.route({
			method: "DELETE",
			path: "/resources/{resourceType}/{resourceId}/grants",
			summary: "Revoke direct access from a resource",
			tags: [
				"Resources",
			],
		})
		.input(resourceRevokeInputSchema)
		.output(resourceRevokeResponseSchema),
	getVisibility: base
		.route({
			method: "GET",
			path: "/resources/{resourceType}/{resourceId}/visibility",
			summary: "Get resource visibility",
			tags: [
				"Resources",
			],
		})
		.input(resourceGetVisibilityInputSchema)
		.output(resourceGetVisibilityResponseSchema),
	setVisibility: base
		.route({
			method: "POST",
			path: "/resources/{resourceType}/{resourceId}/visibility",
			summary: "Set resource visibility",
			tags: [
				"Resources",
			],
		})
		.input(resourceSetVisibilityInputSchema)
		.output(
			resourceSetVisibilityResponseSchema.extend({
				meta: zedTokenSchema.optional(),
			}),
		),
};
