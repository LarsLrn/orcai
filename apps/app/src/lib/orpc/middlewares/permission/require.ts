import type { EntityIdFor, EntityType, PermissionFor } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { withName } from "@/lib/orpc/middlewares/utils";
import { checkPermissionMiddleware } from "./checks";
import { ensurePermission, permissionBase } from "./core";
import {
	createResourcePermissionInput,
	type ResourcePermissionSource,
	type ResourcePermissionSourceWithToken,
	type SharedResourcePermission,
} from "./resource";
import type { CheckPermissionInput } from "./types";

type EntityPermissionSource<
	Entity extends EntityType,
	IdKey extends string,
> = Record<IdKey, EntityIdFor<Entity>>;

type EntityPermissionSourceWithToken<
	Entity extends EntityType,
	IdKey extends string,
	ZedTokenKey extends string,
> = EntityPermissionSource<Entity, IdKey> &
	Partial<Record<ZedTokenKey, string | undefined>>;

export const requireEntityPermission = <
	Entity extends EntityType,
	IdKey extends string,
	ZedTokenKey extends string | undefined = undefined,
>(
	entityType: Entity,
	permission: PermissionFor<Entity>,
	keys: {
		/** The key in the input where the entity ID can be found. */
		entityId: IdKey;
		/** If the permission check requires a ZedToken, it can be provided in the input and specified with this key. If not provided, the middleware will look for a ZedToken in the context meta. */
		zedToken?: ZedTokenKey;
	},
) => {
	if (keys.zedToken) {
		const zedTokenKey = keys.zedToken;

		return checkPermissionMiddleware.adaptInput(
			(
				input: EntityPermissionSourceWithToken<
					Entity,
					IdKey,
					Exclude<ZedTokenKey, undefined>
				>,
			): CheckPermissionInput =>
				({
					entityType,
					entityId: input[keys.entityId] as EntityIdFor<Entity>,
					permission,
					zedToken: input[zedTokenKey],
				}) as CheckPermissionInput,
		);
	}

	return checkPermissionMiddleware.adaptInput(
		(input: EntityPermissionSource<Entity, IdKey>): CheckPermissionInput =>
			({
				entityType,
				entityId: input[keys.entityId] as EntityIdFor<Entity>,
				permission,
			}) as CheckPermissionInput,
	);
};

export const requireResourcePermission = <
	Permission extends SharedResourcePermission,
	ZedTokenKey extends string | undefined = undefined,
>(
	permission: Permission,
	keys?: {
		zedToken: ZedTokenKey;
	},
) => {
	if (keys?.zedToken) {
		const zedTokenKey = keys.zedToken;

		return checkPermissionMiddleware.adaptInput(
			(
				input: ResourcePermissionSourceWithToken<
					Exclude<ZedTokenKey, undefined>
				>,
			) => createResourcePermissionInput(input, permission, input[zedTokenKey]),
		);
	}

	return checkPermissionMiddleware.adaptInput(
		(input: ResourcePermissionSource) =>
			createResourcePermissionInput(input, permission),
	);
};

type OrganizationPermission = PermissionFor<"organization">;

export const requireOrganizationPermission = (
	permission: OrganizationPermission,
) =>
	withName(
		permissionBase.middleware(({ context, errors, next }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const organizationId = context.auth.session.activeOrganizationId;

					if (!organizationId) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message:
									"An active organization must be selected to access this resource.",
							}),
						);
					}

					yield* ensurePermission({
						context,
						errors,
						input: {
							entityType: "organization",
							entityId: organizationId,
							permission,
						},
					});

					return next({
						context: {
							auth: {
								...context.auth,
								session: {
									...context.auth.session,
									activeOrganizationId: organizationId,
								},
							},
						},
					});
				}),
			),
		),
		`requireOrganizationPermission:${permission}`,
	);
