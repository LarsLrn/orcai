import { dbSchema, enumSchema } from "@orcai/db/schema";
import {
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	groupIdSchema,
	groupSchema,
	statusResponseSchema,
	userIdSchema,
} from "@orcai/schema";
import { createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod/v4";

export {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	groupKindSchema,
	groupSystemKeySchema,
} from "@orcai/schema";

const resourceGrantDbSchema = createSelectSchema(dbSchema.resourceGrant);
const resourceVisibilityDbSchema = createSelectSchema(
	dbSchema.resourceVisibility,
);
const userDbSchema = createSelectSchema(dbSchema.user);

export const resourceTypeSchema = resourceGrantDbSchema.shape.resourceType;
export const resourceGrantRoleSchema = resourceGrantDbSchema.shape.role;
export const principalTypeSchema = resourceGrantDbSchema.shape.principalType;
export const resourceVisibilitySchema =
	resourceVisibilityDbSchema.shape.visibility;
export const RESOURCE_TYPES = enumSchema.resourceTypeEnum.enumValues;

const assetResourceIdentitySchema = z.object({
	resourceType: z.literal("asset"),
	resourceId: assetIdSchema,
});

const blockResourceIdentitySchema = z.object({
	resourceType: z.literal("block"),
	resourceId: blockIdSchema,
});

const botResourceIdentitySchema = z.object({
	resourceType: z.literal("bot"),
	resourceId: botIdSchema,
});

const resourceIdentityVariants = [
	assetResourceIdentitySchema,
	blockResourceIdentitySchema,
	botResourceIdentitySchema,
] as const;

export const createResourceScopedSchema = <TShape extends z.ZodRawShape>(
	shape: TShape,
) =>
	z.discriminatedUnion("resourceType", [
		assetResourceIdentitySchema.extend(shape),
		blockResourceIdentitySchema.extend(shape),
		botResourceIdentitySchema.extend(shape),
	]);

const assetResourceRefSchema = z.object({
	type: z.literal("asset"),
	id: assetIdSchema,
});

const blockResourceRefSchema = z.object({
	type: z.literal("block"),
	id: blockIdSchema,
});

const botResourceRefSchema = z.object({
	type: z.literal("bot"),
	id: botIdSchema,
});

const resourceRefVariants = [
	assetResourceRefSchema,
	blockResourceRefSchema,
	botResourceRefSchema,
] as const;

export const resourceIdentitySchema = z.discriminatedUnion(
	"resourceType",
	resourceIdentityVariants,
);

export const resourceRefSchema = z.discriminatedUnion(
	"type",
	resourceRefVariants,
);

const resourcePrincipalIdentitySchema = z.discriminatedUnion("principalType", [
	z.object({
		principalType: z.literal("user"),
		principalId: userIdSchema,
	}),
	z.object({
		principalType: z.literal("group"),
		principalId: groupIdSchema,
	}),
]);

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

const resourceGrantFieldsSchema = resourceGrantDbSchema.pick({
	id: true,
	principalType: true,
	principalId: true,
	role: true,
	grantedBy: true,
	createdAt: true,
	revokedAt: true,
});

export const resourceGrantSelectSchema = createResourceScopedSchema(
	resourceGrantFieldsSchema.shape,
);

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

const groupPrincipalSchema = groupSchema
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
	INHERITED_BOT: "inherited:bot",
	INHERITED_BLOCK: "inherited:block",
	PUBLIC: "public",
} as const;

export const resourceGrantSourceSchema = z.enum([
	RESOURCE_GRANT_SOURCE.DIRECT_USER,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS,
	RESOURCE_GRANT_SOURCE.INHERITED_BOT,
	RESOURCE_GRANT_SOURCE.INHERITED_BLOCK,
	RESOURCE_GRANT_SOURCE.PUBLIC,
]);

export const resourceGrantWithSourceSelectSchema = createResourceScopedSchema({
	...resourceGrantFieldsSchema.shape,
	principal: resourcePrincipalSchema,
	source: resourceGrantSourceSchema,
});

const resourceVisibilityFieldsSchema = resourceVisibilityDbSchema.pick({
	visibility: true,
	updatedBy: true,
	updatedAt: true,
});

export const resourceVisibilitySelectSchema = createResourceScopedSchema(
	resourceVisibilityFieldsSchema.shape,
);

const resourceVisibilityDataSchema = createResourceScopedSchema({
	visibility: resourceVisibilitySchema,
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

export const resourceRevokeResponseSchema = statusResponseSchema;

export const resourceGetVisibilityInputSchema = resourceIdentitySchema;

export const resourceGetVisibilityResponseSchema = z.object({
	data: resourceVisibilityDataSchema,
});

export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type ResourceGrantRole = z.infer<typeof resourceGrantRoleSchema>;
export type ResourceVisibility = z.infer<typeof resourceVisibilitySchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type ResourceGrantSource = z.infer<typeof resourceGrantSourceSchema>;
export type ResourceRef = z.infer<typeof resourceRefSchema>;
export type ResourceGrant = z.infer<typeof resourceGrantWithSourceSelectSchema>;
export type ResourcePrincipal = z.infer<typeof resourcePrincipalSchema>;
