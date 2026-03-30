import type { enumSchema } from "@/db/schema";

/**
 * Entity types as defined in the Spice schema.
 */
export type EntityType =
	| ResourceType
	| "user"
	| "group"
	| "chat"
	| "organization";

export type ResourceType =
	(typeof enumSchema.resourceTypeEnum.enumValues)[number];

/**
 * Organization create capabilities are modeled explicitly in Spice
 * as distinct permissions (`create_<resource>`).
 */
export type OrganizationCreatableResource = ResourceType;
export type OrganizationCreatePermission =
	`create_${OrganizationCreatableResource}`;
export type OrganizationPermission =
	| "read"
	| "manage_members"
	| "invite"
	| OrganizationCreatePermission;

/**
 * Permissions are Spice permission names and are entity-specific.
 * These are directly aligned with `schema.zed`.
 */
export type PermissionByEntity = {
	organization: OrganizationPermission;
	group: "read" | "manage";
	bot: "read" | "use" | "fork" | "edit" | "delete" | "manage_access";
	block: "read" | "use" | "fork" | "edit" | "delete" | "manage_access";
	asset:
		| "read"
		| "download"
		| "use"
		| "fork"
		| "edit"
		| "delete"
		| "manage_access";
	chat: "read" | "edit" | "delete";
	user: never;
};

export type PermissionFor<E extends EntityType> = PermissionByEntity[E];
export type Permission = PermissionByEntity[EntityType];

/**
 * Relationship labels in Spice can represent either:
 * - access role assignments (e.g. manager/editor/viewer), or
 * - graph edges between entities (e.g. bot, block, organization).
 */
export type RelationshipByEntity = {
	organization: "owner" | "instructor" | "student";
	group: "organization" | "member";
	bot: "owner" | "manager" | "editor" | "viewer" | "public";
	block: "owner" | "manager" | "editor" | "viewer" | "public" | "bot";
	asset: "owner" | "manager" | "editor" | "viewer" | "public" | "block";
	chat: "owner" | "bot";
	user: never;
};

export type RelationshipFor<E extends EntityType> = RelationshipByEntity[E];
export type Relationship = RelationshipByEntity[EntityType];
