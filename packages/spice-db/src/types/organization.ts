import type { ResourceType } from "./resource-type";

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
