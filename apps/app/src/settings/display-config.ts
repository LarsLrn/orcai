import type { ResourceGrantRole } from "@orcai/schema";
import type { ResourceType } from "@orcai/spice-db";
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

const resourceTypeLabels: Record<ResourceType, () => string> = {
	bot: m.access_resource_bot_label,
	block: m.access_resource_block_label,
	asset: m.access_resource_asset_label,
};

const resourceAccessHints: Record<ResourceType, () => string> = {
	bot: m.access_resource_bot_hint,
	block: m.access_resource_block_hint,
	asset: m.access_resource_asset_hint,
};

export const RESOURCE_GRANT_ROLES = [
	"viewer",
	"editor",
	"manager",
] as const satisfies readonly ResourceGrantRole[];

export const getResourceRoleLabel = (role: ResourceGrantRole) =>
	resourceRoleLabels[role]();

export const getResourceRoleOptions = () =>
	RESOURCE_GRANT_ROLES.map((role) => ({
		value: role,
		label: resourceRoleLabels[role](),
		description: resourceRoleDescriptions[role](),
	}));

export const getResourceTypeLabel = (type: ResourceType) =>
	resourceTypeLabels[type]();

export const getResourceAccessHint = (type: ResourceType) =>
	resourceAccessHints[type]();
