export const AUTHZ_RESOURCE_TYPES = [
	"bot",
	"block",
	"asset",
] as const;

export const AUTHZ_ENTITY_TYPES = [
	...AUTHZ_RESOURCE_TYPES,
	"user",
	"group",
	"chat",
	"organization",
] as const;

export const AUTHZ_CAPABILITY_ENTITY_TYPES = [
	"asset",
	"block",
	"bot",
	"chat",
	"group",
	"organization",
] as const;

export const AUTHZ_PERMISSIONS_BY_ENTITY = {
	organization: [
		"read",
		"manage_organization",
		"manage_members",
		"manage_groups",
		"invite_members",
		"create_bot",
		"create_block",
		"create_asset",
		"manage_providers",
		"manage_models",
		"manage_quotas",
	],
	group: [
		"read",
		"manage",
	],
	bot: [
		"read",
		"use",
		"fork",
		"edit",
		"delete",
		"manage_access",
	],
	block: [
		"read",
		"use",
		"fork",
		"edit",
		"delete",
		"manage_access",
	],
	asset: [
		"read",
		"download",
		"use",
		"fork",
		"edit",
		"delete",
		"manage_access",
	],
	chat: [
		"read",
		"edit",
		"delete",
	],
	user: [],
} as const satisfies Record<AuthzEntityType, readonly string[]>;

export const ORGANIZATION_ROLES = [
	"admin",
	"manager",
	"member",
	"viewer",
] as const;

export type AuthzResourceType = (typeof AUTHZ_RESOURCE_TYPES)[number];
export type AuthzEntityType = (typeof AUTHZ_ENTITY_TYPES)[number];
export type AuthzCapabilityEntityType =
	(typeof AUTHZ_CAPABILITY_ENTITY_TYPES)[number];
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type PermissionByEntity = {
	[Entity in AuthzEntityType]: (typeof AUTHZ_PERMISSIONS_BY_ENTITY)[Entity][number];
};

export type PermissionFor<Entity extends AuthzEntityType> =
	PermissionByEntity[Entity];

export type Permission = PermissionByEntity[AuthzEntityType];

export type OrganizationCreatableResource = AuthzResourceType;
export type OrganizationCreatePermission =
	`create_${OrganizationCreatableResource}`;
export type OrganizationPermission = PermissionByEntity["organization"];

export const ORGANIZATION_ROLE_PERMISSIONS = {
	admin: AUTHZ_PERMISSIONS_BY_ENTITY.organization,
	manager: [
		"read",
		"manage_members",
		"manage_groups",
		"invite_members",
		"create_bot",
		"create_block",
		"create_asset",
	],
	member: [
		"read",
		"create_bot",
		"create_block",
		"create_asset",
	],
	viewer: [
		"read",
	],
} as const satisfies Record<
	OrganizationRole,
	readonly OrganizationPermission[]
>;

export type CapabilityEntityType = AuthzCapabilityEntityType;
export type CapabilityByEntity = {
	[Entity in CapabilityEntityType]: PermissionFor<Entity>;
};
export type CapabilityFor<Entity extends CapabilityEntityType> =
	CapabilityByEntity[Entity];
export type Capability = CapabilityByEntity[CapabilityEntityType];
export type EntityCapabilities<Entity extends CapabilityEntityType> = Record<
	string,
	boolean
> &
	Partial<Record<CapabilityFor<Entity>, boolean>>;
