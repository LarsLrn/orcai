import type { EntityIdFor, EntityType, PermissionFor } from "@orcai/spice-db";
import type { AuthContext } from "@/lib/orpc/middlewares/auth";

export type CheckPermissionInputFor<Entity extends EntityType> = {
	entityId: EntityIdFor<Entity>;
	permission: PermissionFor<Entity>;
	entityType: Entity;
	zedToken?: string;
};

export type CheckPermissionInput = {
	[Entity in EntityType]: CheckPermissionInputFor<Entity>;
}[EntityType];

export type CheckManyPermissionInputFor<Entity extends EntityType> = {
	entityIds: readonly EntityIdFor<Entity>[];
	permission: PermissionFor<Entity>;
	zedToken?: string;
};

export type PermissionContext = AuthContext & {
	meta?: {
		zedToken?: string;
	};
};
