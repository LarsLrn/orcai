import { z } from "zod/v4";
import { blockIdSchema } from "../shared/ids";
import { paginationInputSchema } from "../shared/pagination";
import { zedTokenSchema } from "../shared/zed-token";
import {
	createResourceScopedSchema,
	principalTypeSchema,
	resourceGrantRoleSchema,
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
	resourceVisibilitySchema,
} from "./schema";

export const resourceGrantInputSchema = z.intersection(
	resourceIdentitySchema,
	z.object({
		principals: z.array(resourcePrincipalIdentitySchema).min(1).max(50),
		role: resourceGrantRoleSchema,
	}),
);

export const resourceRevokeInputSchema = z.intersection(
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
);

export const resourceListGrantsInputSchema = resourceIdentitySchema;

export const resourceInheritedAccessInputSchema = resourceIdentitySchema;

export const resourceListPrincipalsInputSchema = createResourceScopedSchema({
	principalType: principalTypeSchema.optional(),
	query: z.string().trim().max(200).optional(),
	...paginationInputSchema.shape,
	/** Leave out principals that already hold a direct grant on this resource. */
	excludeGranted: z.boolean().default(false),
});

export const resourceSetVisibilityInputSchema = createResourceScopedSchema({
	visibility: resourceVisibilitySchema,
	/** The bot's unlisted blocks the actor confirmed to list with it. */
	listBlockIds: z.array(blockIdSchema).default([]),
});

export const resourceListingImpactInputSchema = resourceIdentitySchema;

export const resourceGetVisibilityInputSchema = resourceIdentitySchema;

/** Resources by id, of which only those the user can read come back. */
export const resourceFindManyInputSchema = z.object({
	resources: z.array(resourceIdentitySchema).min(1).max(50),
	...zedTokenSchema.shape,
});

export const resourceListRecentInputSchema = z.object({
	limit: z.number().int().positive().max(20).default(8),
	...zedTokenSchema.shape,
});
