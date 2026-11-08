import type { AuthzEntityType, PermissionFor } from "@orcai/core";
import type { EntityIdFor, ReadRevision } from "@orcai/spice-db";

export type CheckPermissionInputFor<Entity extends AuthzEntityType> = {
	entityId: EntityIdFor<Entity>;
	permission: PermissionFor<Entity>;
	entityType: Entity;
	zedToken?: ReadRevision;
};

export type CheckPermissionInput = {
	[Entity in AuthzEntityType]: CheckPermissionInputFor<Entity>;
}[AuthzEntityType];

export type CheckManyPermissionInputFor<Entity extends AuthzEntityType> = {
	entityIds: readonly EntityIdFor<Entity>[];
	permission: PermissionFor<Entity>;
	zedToken?: ReadRevision;
};
