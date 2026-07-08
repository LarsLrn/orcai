import type { EntityType } from "./entity-type";

/**
 * Relationship labels in Spice can represent either:
 * - access role assignments (e.g. manager/editor/viewer), or
 * - graph edges between entities (e.g. bot, block, organization).
 */
export type RelationshipByEntity = {
	organization: "admin" | "manager" | "member" | "viewer";
	group: "organization" | "member";
	bot: "owner" | "manager" | "editor" | "viewer" | "public";
	block: "owner" | "manager" | "editor" | "viewer" | "public" | "bot";
	asset: "owner" | "manager" | "editor" | "viewer" | "public" | "block";
	chat: "owner" | "bot";
	user: never;
};

export type RelationshipFor<E extends EntityType> = RelationshipByEntity[E];
export type Relationship = RelationshipByEntity[EntityType];
