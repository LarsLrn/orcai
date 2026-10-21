import type { UserId } from "@orcai/core";
import type { CapabilityEntityType, EntityCapabilities } from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	type PermissionFor,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { capabilitySets, emptyCapabilities } from "@/lib/authz/capabilities";

type CapabilityParams<Entity extends CapabilityEntityType> = {
	entityType: Entity;
	userId: UserId;
	/** Defaults to every capability of the entity type; the others read false. */
	permissions?: readonly PermissionFor<Entity>[];
	zedToken?: string;
};

/** The capabilities the user holds on each of `entityIds`, in one round trip. */
export const getManyEntityCapabilities = <Entity extends CapabilityEntityType>(
	params: CapabilityParams<Entity> & {
		entityIds: readonly EntityIdFor<Entity>[];
	},
) =>
	grantedPermissions({
		entityType: params.entityType,
		entityIds: params.entityIds,
		permissions:
			params.permissions ??
			(capabilitySets[params.entityType] as readonly PermissionFor<Entity>[]),
		userId: params.userId,
		zedToken: params.zedToken,
	}).pipe(
		Effect.map(
			(granted) =>
				new Map(
					params.entityIds.map((entityId) => {
						const capabilities: Record<string, boolean> = emptyCapabilities(
							params.entityType,
						);
						for (const permission of granted.get(entityId) ?? []) {
							capabilities[permission] = true;
						}
						return [
							entityId,
							capabilities as EntityCapabilities<Entity>,
						] as const;
					}),
				),
		),
	);

/** The capabilities the user holds on one entity, in one round trip. */
export const getEntityCapabilities = <Entity extends CapabilityEntityType>(
	params: CapabilityParams<Entity> & {
		entityId: EntityIdFor<Entity>;
	},
) =>
	getManyEntityCapabilities({
		...params,
		entityIds: [
			params.entityId,
		],
	}).pipe(
		Effect.map(
			(capabilities) =>
				capabilities.get(params.entityId) ??
				emptyCapabilities(params.entityType),
		),
	);
