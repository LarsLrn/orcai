import {
	ORGANIZATION_ROLE_PERMISSIONS,
	ORGANIZATION_ROLES,
	type OrganizationRole,
} from "@orcai/core";

export const organizationRoleLabels = {
	admin: "Admin",
	manager: "Manager",
	member: "Member",
	viewer: "Viewer",
} as const satisfies Record<OrganizationRole, string>;

const organizationPermissionLabels = {
	read: "Read workspace",
	manage_organization: "Manage organisation",
	manage_members: "Manage members",
	manage_groups: "Manage groups",
	invite_members: "Invite members",
	create_bot: "Create bots",
	create_block: "Create blocks",
	create_asset: "Create assets",
	manage_providers: "Manage providers",
	manage_models: "Manage models",
	manage_quotas: "Manage quotas",
} as const;

export const getOrganizationRoleDescription = (role: OrganizationRole) =>
	ORGANIZATION_ROLE_PERMISSIONS[role]
		.map((permission) => organizationPermissionLabels[permission])
		.join(", ");

export const getAssignableOrganizationRoles = (params: {
	canManageOrganization: boolean;
}) =>
	ORGANIZATION_ROLES.filter(
		(role) => params.canManageOrganization || role !== "admin",
	);
