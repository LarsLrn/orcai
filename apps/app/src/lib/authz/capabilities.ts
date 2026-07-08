import { AUTHZ_PERMISSIONS_BY_ENTITY } from "@orcai/core";
import type {
	CapabilityEntityType,
	CapabilityFor,
	EntityCapabilities,
} from "@orcai/schema";

export const capabilitySets = AUTHZ_PERMISSIONS_BY_ENTITY satisfies {
	[Entity in CapabilityEntityType]: readonly CapabilityFor<Entity>[];
};

export const emptyCapabilities = <Entity extends CapabilityEntityType>(
	entityType: Entity,
): EntityCapabilities<Entity> =>
	Object.fromEntries(
		capabilitySets[entityType].map((permission) => [
			permission,
			false,
		]),
	) as EntityCapabilities<Entity>;

export const hasCapability = <
	Entity extends CapabilityEntityType,
	Permission extends CapabilityFor<Entity>,
>(
	capabilities: Partial<Record<Permission, boolean>> | undefined,
	permission: Permission,
) => capabilities?.[permission] === true;
