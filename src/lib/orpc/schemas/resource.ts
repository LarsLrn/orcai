import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema, enumSchema } from "@/db/schema";
import { statusSchema } from "./shared";

const resourceGrantDbSchema = createSelectSchema(dbSchema.resourceGrant);
const resourceVisibilityDbSchema = createSelectSchema(
	dbSchema.resourceVisibility,
);
const groupDbSchema = createSelectSchema(dbSchema.group);
const userDbSchema = createSelectSchema(dbSchema.user);

export const resourceTypeSchema = resourceGrantDbSchema.shape.resourceType;
export const resourceGrantRoleSchema = resourceGrantDbSchema.shape.role;
export const principalTypeSchema = resourceGrantDbSchema.shape.principalType;
export const resourceVisibilitySchema =
	resourceVisibilityDbSchema.shape.visibility;
export const groupKindSchema = groupDbSchema.shape.kind;
export const groupSystemKeySchema = groupDbSchema.shape.systemKey;
export const RESOURCE_TYPES = enumSchema.resourceTypeEnum.enumValues;
export const ALL_MEMBERS_GROUP_SYSTEM_KEY =
	enumSchema.groupSystemKeyEnum.enumValues[0];

export const resourceRefSchema = z.object({
	type: resourceTypeSchema,
	id: z.uuidv4(),
});

export const resourceGrantInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
	principalType: principalTypeSchema,
	principalId: z.uuidv4(),
	role: resourceGrantRoleSchema,
});

export const resourceRevokeInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
	principalType: principalTypeSchema,
	principalId: z.uuidv4(),
});

export const resourceListGrantsInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
});

export const resourceListPrincipalsInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
	principalType: principalTypeSchema.optional(),
	query: z.string().trim().max(200).optional(),
	limit: z.number().int().positive().max(100).default(25),
});

export const resourceSetVisibilityInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
	visibility: resourceVisibilitySchema,
});

export const resourceGrantSelectSchema = resourceGrantDbSchema.pick({
	id: true,
	resourceType: true,
	resourceId: true,
	principalType: true,
	principalId: true,
	role: true,
	grantedBy: true,
	createdAt: true,
	revokedAt: true,
});

const userPrincipalSchema = userDbSchema
	.pick({
		id: true,
		name: true,
		email: true,
		image: true,
	})
	.extend({
		type: z.literal("user"),
	});

const groupPrincipalSchema = groupDbSchema
	.pick({
		id: true,
		name: true,
		description: true,
		kind: true,
		systemKey: true,
		organizationId: true,
	})
	.extend({
		type: z.literal("group"),
	});

export const resourcePrincipalSchema = z.discriminatedUnion("type", [
	userPrincipalSchema,
	groupPrincipalSchema,
]);

export const RESOURCE_GRANT_SOURCE = {
	DIRECT_USER: "direct:user",
	DIRECT_GROUP: "direct:group",
	DIRECT_GROUP_ALL_MEMBERS: "direct:group:all_members",
	INHERITED_COURSE: "inherited:course",
	INHERITED_BOT: "inherited:bot",
	INHERITED_BLOCK: "inherited:block",
	PUBLIC: "public",
} as const;

export const resourceGrantSourceSchema = z.enum([
	RESOURCE_GRANT_SOURCE.DIRECT_USER,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS,
	RESOURCE_GRANT_SOURCE.INHERITED_COURSE,
	RESOURCE_GRANT_SOURCE.INHERITED_BOT,
	RESOURCE_GRANT_SOURCE.INHERITED_BLOCK,
	RESOURCE_GRANT_SOURCE.PUBLIC,
]);

export const resourceGrantWithSourceSelectSchema =
	resourceGrantSelectSchema.extend({
		principal: resourcePrincipalSchema,
		source: resourceGrantSourceSchema,
	});

export const resourceVisibilitySelectSchema = resourceVisibilityDbSchema.pick({
	resourceType: true,
	resourceId: true,
	visibility: true,
	updatedBy: true,
	updatedAt: true,
});

export const resourceGrantResponseSchema = z.object({
	data: resourceGrantWithSourceSelectSchema,
});

export const resourceListGrantsResponseSchema = z.object({
	data: z.array(resourceGrantWithSourceSelectSchema),
	rowCount: z.number(),
});

export const resourceListPrincipalsResponseSchema = z.object({
	data: z.array(resourcePrincipalSchema),
	rowCount: z.number(),
});

export const resourceSetVisibilityResponseSchema = z.object({
	data: resourceVisibilitySelectSchema,
});

export const resourceRevokeResponseSchema = statusSchema;

export const resourceGetVisibilityInputSchema = z.object({
	resourceType: resourceTypeSchema,
	resourceId: z.uuidv4(),
});

export const resourceGetVisibilityResponseSchema = z.object({
	data: resourceVisibilitySelectSchema.pick({
		resourceType: true,
		resourceId: true,
		visibility: true,
	}),
});

export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type ResourceGrantRole = z.infer<typeof resourceGrantRoleSchema>;
export type ResourceVisibility = z.infer<typeof resourceVisibilitySchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type ResourceGrantSource = z.infer<typeof resourceGrantSourceSchema>;
export type ResourceRef = z.infer<typeof resourceRefSchema>;
export type ResourceGrant = z.infer<typeof resourceGrantWithSourceSelectSchema>;
export type ResourcePrincipal = z.infer<typeof resourcePrincipalSchema>;
