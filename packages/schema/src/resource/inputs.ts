import { z } from "zod/v4";
import {
	createResourceScopedSchema,
	principalTypeSchema,
	resourceGrantRoleSchema,
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
	resourceVisibilitySchema,
} from "./schema";

const resourceGrantRoleFieldsSchema = z.object({
	role: resourceGrantRoleSchema,
});

export const resourceGrantInputSchema = z.intersection(
	resourceIdentitySchema,
	z.intersection(
		resourcePrincipalIdentitySchema,
		resourceGrantRoleFieldsSchema,
	),
);

export const resourceRevokeInputSchema = z.intersection(
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
);

export const resourceListGrantsInputSchema = resourceIdentitySchema;

export const resourceListPrincipalsInputSchema = createResourceScopedSchema({
	principalType: principalTypeSchema.optional(),
	query: z.string().trim().max(200).optional(),
	limit: z.number().int().positive().max(100).default(25),
});

export const resourceSetVisibilityInputSchema = createResourceScopedSchema({
	visibility: resourceVisibilitySchema,
});

export const resourceGetVisibilityInputSchema = resourceIdentitySchema;

export type ResourceGrantInput = z.infer<typeof resourceGrantInputSchema>;
export type ResourceRevokeInput = z.infer<typeof resourceRevokeInputSchema>;
export type ResourceListGrantsInput = z.infer<
	typeof resourceListGrantsInputSchema
>;
export type ResourceListPrincipalsInput = z.infer<
	typeof resourceListPrincipalsInputSchema
>;
export type ResourceSetVisibilityInput = z.infer<
	typeof resourceSetVisibilityInputSchema
>;
export type ResourceGetVisibilityInput = z.infer<
	typeof resourceGetVisibilityInputSchema
>;
