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
} from "@/lib/orpc/schemas/resource";
import { zedTokenSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listResourceGrantsContract = base
	.route({
		method: "GET",
		path: "/resources/{resourceType}/{resourceId}/grants",
		summary: "List direct grants for a resource",
		tags: [
			"Resources",
		],
	})
	.input(resourceListGrantsInputSchema)
	.output(resourceListGrantsResponseSchema);

export const listResourcePrincipalsContract = base
	.route({
		method: "GET",
		path: "/resources/{resourceType}/{resourceId}/principals",
		summary: "List principals that can be directly granted on a resource",
		tags: [
			"Resources",
		],
	})
	.input(resourceListPrincipalsInputSchema)
	.output(resourceListPrincipalsResponseSchema);

export const grantResourceAccessContract = base
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
	);

export const revokeResourceAccessContract = base
	.route({
		method: "DELETE",
		path: "/resources/{resourceType}/{resourceId}/grants",
		summary: "Revoke direct access from a resource",
		tags: [
			"Resources",
		],
	})
	.input(resourceRevokeInputSchema)
	.output(resourceRevokeResponseSchema);

export const getResourceVisibilityContract = base
	.route({
		method: "GET",
		path: "/resources/{resourceType}/{resourceId}/visibility",
		summary: "Get resource visibility",
		tags: [
			"Resources",
		],
	})
	.input(resourceGetVisibilityInputSchema)
	.output(resourceGetVisibilityResponseSchema);

export const setResourceVisibilityContract = base
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
	);
