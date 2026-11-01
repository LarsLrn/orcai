import {
	ORGANIZATION_ADMIN_ROLE,
	ORGANIZATION_ROLE_PERMISSIONS,
	ORGANIZATION_ROLES,
	type OrganizationRole,
} from "@orcai/core";
import { m } from "@/paraglide/messages";

type OrganizationPermission =
	(typeof ORGANIZATION_ROLE_PERMISSIONS)[OrganizationRole][number];

const organizationRoleLabels: Record<OrganizationRole, () => string> = {
	admin: m.orgs_role_admin_label,
	manager: m.orgs_role_manager_label,
	member: m.orgs_role_member_label,
	viewer: m.orgs_role_viewer_label,
};

const organizationPermissionLabels: Record<
	OrganizationPermission,
	() => string
> = {
	read: m.orgs_permission_read_label,
	manage_organization: m.orgs_permission_manage_organisation_label,
	manage_members: m.orgs_permission_manage_members_label,
	manage_groups: m.orgs_permission_manage_groups_label,
	invite_members: m.orgs_permission_invite_members_label,
	create_bot: m.orgs_permission_create_bot_label,
	create_block: m.orgs_permission_create_block_label,
	create_asset: m.orgs_permission_create_asset_label,
	manage_providers: m.orgs_permission_manage_providers_label,
	manage_models: m.orgs_permission_manage_models_label,
	manage_quota_pools: m.orgs_permission_manage_quota_pools_label,
	view_analytics: m.orgs_permission_view_analytics_label,
	install_resource: m.orgs_permission_install_resource_label,
};

export const getOrganizationRoleLabel = (role: OrganizationRole) =>
	organizationRoleLabels[role]();

export const getOrganizationRoleDescription = (role: OrganizationRole) =>
	ORGANIZATION_ROLE_PERMISSIONS[role]
		.map((permission) => organizationPermissionLabels[permission]())
		.join(", ");

export const getAssignableOrganizationRoles = (params: {
	canManageOrganization: boolean;
}) =>
	ORGANIZATION_ROLES.filter(
		(role) => params.canManageOrganization || role !== ORGANIZATION_ADMIN_ROLE,
	);
