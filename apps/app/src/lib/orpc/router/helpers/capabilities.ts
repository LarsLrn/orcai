import type { UserId } from "@orcai/core";
import type {
	CapabilityEntityType,
	CapabilityFor,
	EntityCapabilities,
} from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	type EntityIdFor,
	type EntityType,
	hasPermission,
	type PermissionFor,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { capabilitySets, emptyCapabilities } from "@/lib/authz/capabilities";

export const getEntityCapabilities = <
	Entity extends CapabilityEntityType,
>(params: {
	entityType: Entity;
	entityId: string;
	userId: string;
	permissions?: readonly CapabilityFor<Entity>[];
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const capabilities = emptyCapabilities(params.entityType);
		const permissions = params.permissions ?? capabilitySets[params.entityType];

		for (const permission of permissions) {
			const result = yield* checkEntityPermission({
				entityType: params.entityType as EntityType,
				entityId: params.entityId as EntityIdFor<EntityType>,
				permission: permission as PermissionFor<EntityType>,
				userId: params.userId as UserId,
				zedToken: params.zedToken,
			});

			(capabilities as Record<string, boolean>)[permission as string] =
				hasPermission(result);
		}

		return capabilities;
	});

export const getManyEntityCapabilities = <
	Entity extends CapabilityEntityType,
>(params: {
	entityType: Entity;
	entityIds: readonly string[];
	userId: string;
	permissions?: readonly CapabilityFor<Entity>[];
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const capabilitiesById = new Map<string, EntityCapabilities<Entity>>(
			params.entityIds.map((entityId) => [
				entityId,
				emptyCapabilities(params.entityType),
			]),
		);
		const permissions = params.permissions ?? capabilitySets[params.entityType];

		for (const permission of permissions) {
			const result = yield* checkManyEntityPermissions({
				entityType: params.entityType as EntityType,
				entityIds: params.entityIds as EntityIdFor<EntityType>[],
				permission: permission as PermissionFor<EntityType>,
				userId: params.userId as UserId,
				zedToken: params.zedToken,
			});

			for (const pair of result.pairs) {
				const entityId = pair.request?.resource?.objectId;
				const capabilities = entityId
					? capabilitiesById.get(entityId)
					: undefined;
				if (!capabilities) {
					continue;
				}

				(capabilities as Record<string, boolean>)[permission as string] =
					pair.response.oneofKind === "item" &&
					hasPermission({
						permissionship: pair.response.item.permissionship,
					});
			}
		}

		return capabilitiesById;
	});
