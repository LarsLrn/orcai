import type { EntityIdFor, EntityType, PermissionFor } from "@orcai/spice-db";
import { checkPermissionMiddleware } from "./checks";
import {
	createResourcePermissionInput,
	type ResourcePermissionSource,
	type SharedResourcePermission,
} from "./resource";
import type { CheckPermissionInput } from "./types";

/** A permission check reads at the token its input carries, else the request's. */
type ZedTokenInput = {
	zedToken?: string | undefined;
};

type EntityPermissionSource<
	Entity extends EntityType,
	IdKey extends string,
> = Record<IdKey, EntityIdFor<Entity>>;

export const requireEntityPermission = <
	Entity extends EntityType,
	IdKey extends string,
>(
	entityType: Entity,
	permission: PermissionFor<Entity>,
	keys: {
		/** The key in the input where the entity ID can be found. */
		entityId: IdKey;
	},
) =>
	checkPermissionMiddleware.adaptInput(
		(
			input: EntityPermissionSource<Entity, IdKey> & ZedTokenInput,
		): CheckPermissionInput => {
			const source: EntityPermissionSource<Entity, IdKey> = input;
			return {
				entityType,
				entityId: source[keys.entityId],
				permission,
				zedToken: input.zedToken,
			} as CheckPermissionInput;
		},
	);

export const requireResourcePermission = <
	Permission extends SharedResourcePermission,
>(
	permission: Permission,
) =>
	checkPermissionMiddleware.adaptInput(
		(input: ResourcePermissionSource & ZedTokenInput) =>
			createResourcePermissionInput(input, permission, input.zedToken),
	);
