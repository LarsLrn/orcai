import type { ResourceGrantRole } from "@/lib/orpc/schemas/resource";
import type { ResourceType } from "@/lib/spice-db/types";

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
		value: "course",
		label: "Course",
		accessHint:
			"Access here controls course visibility/editing and inherited access to linked bots.",
	},
	{
		value: "bot",
		label: "Bot",
		accessHint:
			"Providing access to bots will cascade the access level to all child resources (e.g. bots and blocks).",
	},
	{
		value: "block",
		label: "Block",
		accessHint: "Access may also be inherited from the parent bot.",
	},
	{
		value: "asset",
		label: "Asset",
		accessHint: "Access may also be inherited from the parent block.",
	},
] satisfies {
	value: ResourceType;
	label: string;
	accessHint: string;
}[];
