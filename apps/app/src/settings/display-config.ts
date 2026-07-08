import type { ResourceGrantRole } from "@orcai/schema";
import type { ResourceType } from "@orcai/spice-db";

export const ROLES = [
	{
		value: "viewer",
		label: "Viewer",
		description: "Can view the resource",
	},
	{
		value: "editor",
		label: "Editor",
		description: "Can edit the resource",
	},
	{
		value: "manager",
		label: "Manager",
		description: "Can edit the resource and manage access",
	},
] satisfies {
	value: ResourceGrantRole;
	label: string;
	description: string;
}[];

export const RESOURCES = [
	{
		value: "bot",
		label: "Bot",
		accessHint:
			"Use groups when possible to grant cohort access. Access here cascades to linked blocks and content.",
	},
	{
		value: "block",
		label: "Block",
		accessHint: "Access may also be inherited from the parent bot.",
	},
	{
		value: "asset",
		label: "Content item",
		accessHint: "Access may also be inherited from the parent bot.",
	},
] satisfies {
	value: ResourceType;
	label: string;
	accessHint: string;
}[];
