import type { EntityType } from "./entity-type";
import type { OrganizationPermission } from "./organization";

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
