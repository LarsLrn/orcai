import { z } from "zod/v4";
import { processingStatusSchema } from "../asset/parts/processing-status";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import { blockTypeSchema } from "../block/schema";
import { botIdSchema } from "../bot/ref";
import { groupIdSchema } from "../group/ref";
import { groupSchema } from "../group/schema";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { userIdSchema } from "../user/ref";

export const RESOURCE_TYPES = [
	"bot",
	"block",
	"asset",
] as const;

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

export const resourceGrantRoleSchema = z.enum([
	"viewer",
	"editor",
	"manager",
]);

export const principalTypeSchema = z.enum([
	"user",
	"group",
]);

export const resourceVisibilitySchema = z.enum([
	"private",
	"public",
]);

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

export const resourcePrincipalIdentitySchema = z.discriminatedUnion(
	"principalType",
	[
		z.object({
			principalType: z.literal("user"),
			principalId: userIdSchema,
		}),
		z.object({
			principalType: z.literal("group"),
			principalId: groupIdSchema,
		}),
	],
);

const resourceGrantFieldsSchema = {
	id: z.uuidv4(),
	principalType: principalTypeSchema,
	principalId: z.union([
		userIdSchema,
		groupIdSchema,
	]),
	role: resourceGrantRoleSchema,
	grantedBy: userIdSchema,
	createdAt: z.coerce.date(),
	revokedAt: z.coerce.date().nullable(),
};

const userPrincipalSchema = z.object({
	type: z.literal("user"),
	id: userIdSchema,
	name: z.string(),
	email: z.string().optional(),
	image: z.string().nullable(),
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

export const directGrantSourceSchema = z.enum([
	RESOURCE_GRANT_SOURCE.DIRECT_USER,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP,
	RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS,
]);

export const resourceGrantSchema = createResourceScopedSchema({
	...resourceGrantFieldsSchema,
	principal: resourcePrincipalSchema,
	source: directGrantSourceSchema,
});

/** A bot or block a resource hangs off, whose grants cascade down to it. */
const accessAncestorSchema = z.discriminatedUnion("resourceType", [
	z.object({
		resourceType: z.literal("bot"),
		resourceId: botIdSchema,
		name: z.string(),
	}),
	z.object({
		resourceType: z.literal("block"),
		resourceId: blockIdSchema,
		name: z.string(),
	}),
]);

/**
 * Who reaches a resource without holding a grant on it.
 */
export const inheritedAccessSchema = z.object({
	/** Named ancestors, capped, and only those the viewer may read. */
	ancestors: z.array(accessAncestorSchema),
	/** Totals by type, counted over every ancestor rather than the named ones. */
	botCount: z.number(),
	blockCount: z.number(),
	/** Ancestors left unnamed because the viewer cannot read them. */
	hiddenAncestorCount: z.number(),
	groupCount: z.number(),
	userCount: z.number(),
	/** An ancestor is public, so every user of the instance reads through it. */
	throughPublic: z.boolean(),
});

export const resourceVisibilityRecordSchema = createResourceScopedSchema({
	id: z.uuidv4(),
	visibility: resourceVisibilitySchema,
	updatedBy: userIdSchema,
	updatedAt: z.coerce.date(),
});

export const resourceVisibilityDataSchema = createResourceScopedSchema({
	visibility: resourceVisibilitySchema,
});

/** A resource that changed recently, carrying only what a summary row shows. */
export const recentResourceSchema = z.discriminatedUnion("resourceType", [
	assetResourceIdentitySchema.extend({
		name: z.string(),
		changedAt: z.coerce.date(),
		processingStatus: processingStatusSchema,
	}),
	blockResourceIdentitySchema.extend({
		name: z.string(),
		changedAt: z.coerce.date(),
		blockType: blockTypeSchema,
		status: publicationStatusSchema,
	}),
	botResourceIdentitySchema.extend({
		name: z.string(),
		changedAt: z.coerce.date(),
		status: publicationStatusSchema,
	}),
]);

export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type ResourceGrantRole = z.infer<typeof resourceGrantRoleSchema>;
export type ResourceVisibility = z.infer<typeof resourceVisibilitySchema>;
export type PrincipalType = z.infer<typeof principalTypeSchema>;
export type ResourceGrantSource = z.infer<typeof resourceGrantSourceSchema>;
export type DirectGrantSource = z.infer<typeof directGrantSourceSchema>;
export type ResourceRef = z.infer<typeof resourceRefSchema>;
export type ResourceIdentity = z.infer<typeof resourceIdentitySchema>;
export type ResourceGrant = z.infer<typeof resourceGrantSchema>;
export type RecentResource = z.infer<typeof recentResourceSchema>;
export type ResourcePrincipal = z.infer<typeof resourcePrincipalSchema>;
export type ResourcePrincipalIdentity = z.infer<
	typeof resourcePrincipalIdentitySchema
>;
export type InheritedAccess = z.infer<typeof inheritedAccessSchema>;
export type AccessAncestor = z.infer<typeof accessAncestorSchema>;
