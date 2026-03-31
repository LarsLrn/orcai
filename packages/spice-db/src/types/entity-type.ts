import type { ResourceType } from "./resource-type";

/**
 * Entity types as defined in the Spice schema.
 */
export type EntityType =
	| ResourceType
	| "user"
	| "group"
	| "chat"
	| "organization";
