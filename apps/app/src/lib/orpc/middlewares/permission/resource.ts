import type { EntityIdFor, PermissionFor, ResourceType } from "@orcai/spice-db";
import type { CheckPermissionInput } from "./types";

export type SharedResourcePermission = PermissionFor<"asset"> &
	PermissionFor<"block"> &
	PermissionFor<"bot">;

export type ResourcePermissionSource = {
	[Entity in ResourceType]: {
		resourceType: Entity;
		resourceId: EntityIdFor<Entity>;
	};
}[ResourceType];

export type ResourcePermissionSourceWithToken<ZedTokenKey extends string> =
	ResourcePermissionSource & Partial<Record<ZedTokenKey, string | undefined>>;

export const createResourcePermissionInput = <
	Permission extends SharedResourcePermission,
>(
	input: ResourcePermissionSource,
	permission: Permission,
	zedToken?: string,
): CheckPermissionInput => {
	switch (input.resourceType) {
		case "asset":
			return {
				entityType: "asset",
				entityId: input.resourceId,
				permission,
				zedToken,
			};
		case "block":
			return {
				entityType: "block",
				entityId: input.resourceId,
				permission,
				zedToken,
			};
		case "bot":
			return {
				entityType: "bot",
				entityId: input.resourceId,
				permission,
				zedToken,
			};
	}
};
