import type { AuthzResourceType } from "@orcai/core";
import { RESOURCE_GRANT_ROLES, type ResourceGrantRole } from "@orcai/schema";
import { m } from "@/paraglide/messages";

const resourceRoleLabels: Record<ResourceGrantRole, () => string> = {
	viewer: m.access_role_viewer_label,
	editor: m.access_role_editor_label,
	manager: m.access_role_manager_label,
};

const resourceRoleDescriptions: Record<ResourceGrantRole, () => string> = {
	viewer: m.access_role_viewer_description,
	editor: m.access_role_editor_description,
	manager: m.access_role_manager_description,
};

const resourceAccessHints: Record<AuthzResourceType, () => string> = {
	bot: m.access_resource_bot_hint,
	block: m.access_resource_block_hint,
	asset: m.access_resource_asset_hint,
};

export const getResourceRoleLabel = (role: ResourceGrantRole) =>
	resourceRoleLabels[role]();

export const getResourceRoleOptions = () =>
	RESOURCE_GRANT_ROLES.map((role) => ({
		value: role,
		label: resourceRoleLabels[role](),
		description: resourceRoleDescriptions[role](),
	}));

export const getResourceAccessHint = (type: AuthzResourceType) =>
	resourceAccessHints[type]();
