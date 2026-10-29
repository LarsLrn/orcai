import type { OrganizationId, UserId } from "@orcai/core";
import type { CapabilityEntityType, EntityCapabilities } from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	type PermissionFor,
	type ResourceType,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { capabilitySets, emptyCapabilities } from "@/lib/authz/capabilities";
import { usableInOrganization } from "@/lib/authz/organization-use";

type CapabilityParams<Entity extends CapabilityEntityType> = {
	entityType: Entity;
	userId: UserId;
	/** Where `use` is decided for bots, blocks and assets; without one they read false. */
	organizationId: OrganizationId | undefined;
	/** Defaults to every capability of the entity type; the others read false. */
	permissions?: readonly PermissionFor<Entity>[];
	zedToken?: string;
};

const isResourceType = (
	entityType: CapabilityEntityType,
): entityType is ResourceType =>
	entityType === "bot" || entityType === "block" || entityType === "asset";

/**
 * Narrows SpiceDB's `use` on resources to what the user may use in the
 * organisation.
 */
const narrowUse = <Entity extends CapabilityEntityType>(
	granted: ReadonlyMap<EntityIdFor<Entity>, ReadonlySet<string>>,
	params: CapabilityParams<Entity>,
) =>
	Effect.gen(function* () {
		const { entityType } = params;
		if (!isResourceType(entityType)) return granted;
		const withUse = [
			...granted,
		].flatMap(([id, permissions]) =>
			permissions.has("use")
				? [
						id,
					]
				: [],
		);
		if (withUse.length === 0) return granted;
		const usable: ReadonlySet<string> = yield* usableInOrganization({
			resourceType: entityType,
			resourceIds: withUse as EntityIdFor<typeof entityType>[],
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});
		return new Map(
			[
				...granted,
			].map(([id, permissions]) => [
				id,
				usable.has(id)
					? permissions
					: new Set(
							[
								...permissions,
							].filter((permission) => permission !== "use"),
						),
			]),
		);
	});

/** The capabilities the user holds on each of `entityIds`. */
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
		Effect.flatMap((granted) => narrowUse(granted, params)),
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

/** The capabilities the user holds on one entity. */
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
