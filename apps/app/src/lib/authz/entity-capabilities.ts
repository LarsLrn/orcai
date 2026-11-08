import type {
	AuthzResourceType,
	OrganizationId,
	OrganizationPermission,
	PermissionFor,
	UserId,
} from "@orcai/core";
import type {
	CapabilityEntityType,
	CapabilityFor,
	EntityCapabilities,
} from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	type ReadRevision,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { capabilitySets, emptyCapabilities } from "@/lib/authz/capabilities";
import {
	committedPermittedIds,
	type ResourcePermission,
} from "@/lib/authz/content-access";
import { committedRoles, roleGrants } from "@/lib/authz/organization-access";
import { usableInOrganization } from "@/lib/authz/organization-use";
import { handOverableIds } from "@/lib/authz/ownership";

type CapabilityParams<Entity extends CapabilityEntityType> = {
	entityType: Entity;
	userId: UserId;
	/** Where `use` is decided for bots, blocks and assets; without one they read false. */
	organizationId: OrganizationId | undefined;
	/** Defaults to every capability of the entity type; the others read false. */
	permissions?: readonly CapabilityFor<Entity>[];
	zedToken?: ReadRevision;
};

const isResourceType = (
	entityType: CapabilityEntityType,
): entityType is AuthzResourceType =>
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

/**
 * Narrows SpiceDB's organisation permissions to what the user's committed
 * role grants, so a demotion counts before its tuples arrive.
 */
const narrowOrganization = <Entity extends CapabilityEntityType>(
	granted: ReadonlyMap<EntityIdFor<Entity>, ReadonlySet<string>>,
	params: CapabilityParams<Entity>,
) =>
	Effect.gen(function* () {
		if (params.entityType !== "organization" || granted.size === 0)
			return granted;
		const roles = yield* committedRoles({
			userId: params.userId,
			organizationIds: [
				...granted.keys(),
			] as OrganizationId[],
		});
		return new Map(
			[
				...granted,
			].map(([id, permissions]) => {
				const role = roles.get(id as OrganizationId);
				return [
					id,
					new Set(
						[
							...permissions,
						].filter(
							(permission) =>
								role !== undefined &&
								roleGrants(role, permission as OrganizationPermission),
						),
					),
				];
			}),
		);
	});

const committedCheck = {
	read: "read",
	download: "read",
	fork: "read",
	edit: "edit",
	delete: "delete",
	manage_access: "manage_access",
	use: undefined,
} satisfies Record<
	PermissionFor<AuthzResourceType>,
	ResourcePermission | undefined
>;

/** Narrows resource permissions to committed grants, including the read aliases. */
const narrowResources = <Entity extends CapabilityEntityType>(
	granted: ReadonlyMap<EntityIdFor<Entity>, ReadonlySet<string>>,
	params: CapabilityParams<Entity>,
) =>
	Effect.gen(function* () {
		const { entityType } = params;
		if (!isResourceType(entityType)) return granted;
		const committedPermission = (permission: string) =>
			committedCheck[permission as PermissionFor<AuthzResourceType>];
		const permissions = new Set(
			[
				...granted.values(),
			].flatMap((values) =>
				[
					...values,
				].flatMap((permission) => {
					const key = committedPermission(permission);
					return key === undefined
						? []
						: [
								key,
							];
				}),
			),
		);
		const committedPermissions = new Map(
			yield* Effect.all(
				[
					...permissions,
				].map((permission) =>
					committedPermittedIds(
						entityType,
						[
							...granted,
						].flatMap(([id, values]) =>
							[
								...values,
							].some((value) => committedPermission(value) === permission)
								? [
										id,
									]
								: [],
						) as EntityIdFor<typeof entityType>[],
						params.userId,
						permission,
					).pipe(
						Effect.map(
							(ids) =>
								[
									permission,
									ids as ReadonlySet<string>,
								] as const,
						),
					),
				),
				{
					concurrency: "unbounded",
				},
			),
		);
		return new Map(
			[
				...granted,
			].map(([id, values]) => [
				id,
				new Set(
					[
						...values,
					].filter((permission) => {
						const key = committedPermission(permission);
						return key === undefined || committedPermissions.get(key)?.has(id);
					}),
				),
			]),
		);
	});

/** Adds `hand_over`, which Postgres decides, where the user may hand the item over. */
const addHandOver = <Entity extends CapabilityEntityType>(
	granted: ReadonlyMap<EntityIdFor<Entity>, ReadonlySet<string>>,
	params: CapabilityParams<Entity> & {
		entityIds: readonly EntityIdFor<Entity>[];
	},
) =>
	Effect.gen(function* () {
		const { entityType } = params;
		if (!isResourceType(entityType)) return granted;
		const handOverable: ReadonlySet<string> = yield* handOverableIds({
			resourceType: entityType,
			resourceIds: params.entityIds as EntityIdFor<typeof entityType>[],
			userId: params.userId,
			organizationId: params.organizationId,
		});
		return new Map(
			params.entityIds.map((id) => [
				id,
				handOverable.has(id)
					? new Set([
							...(granted.get(id) ?? []),
							"hand_over",
						])
					: (granted.get(id) ?? new Set<string>()),
			]),
		);
	});

/** The capabilities the user holds on each of `entityIds`. */
export const getManyEntityCapabilities = <Entity extends CapabilityEntityType>(
	params: CapabilityParams<Entity> & {
		entityIds: readonly EntityIdFor<Entity>[];
	},
) => {
	const requested: readonly string[] =
		params.permissions ?? capabilitySets[params.entityType];
	return grantedPermissions({
		entityType: params.entityType,
		entityIds: params.entityIds,
		permissions: requested.filter(
			(permission) => permission !== "hand_over",
		) as PermissionFor<Entity>[],
		userId: params.userId,
		zedToken: params.zedToken,
	}).pipe(
		Effect.flatMap((granted) => narrowResources(granted, params)),
		Effect.flatMap((granted) => narrowUse(granted, params)),
		Effect.flatMap((granted) => narrowOrganization(granted, params)),
		Effect.flatMap((granted) =>
			requested.includes("hand_over")
				? addHandOver(granted, params)
				: Effect.succeed(granted),
		),
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
};

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
