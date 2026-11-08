import type { AuthzEntityType, PermissionFor } from "@orcai/core";
import type { EntityIdFor } from "@orcai/spice-db";
import { checkPermissionMiddleware } from "./checks";
import type { CheckPermissionInput } from "./types";

/** A permission check reads at the token its input carries, else the request's. */
type ZedTokenInput = {
	zedToken?: string | undefined;
};

type EntityPermissionSource<
	Entity extends AuthzEntityType,
	IdKey extends string,
> = Record<IdKey, EntityIdFor<Entity>>;

export const requireEntityPermission = <
	Entity extends AuthzEntityType,
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
