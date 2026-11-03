import type { EntityIdFor, EntityType, PermissionFor } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/effect";
import * as Effect from "effect/Effect";
import { readRevision } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { withName } from "@/lib/orpc/middlewares/utils";
import { checkPermissionMiddleware } from "./checks";
import { permissionBase, requirePermission } from "./core";
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

type OrganizationPermission = PermissionFor<"organization">;

export const requireOrganizationPermission = (
	permission: OrganizationPermission,
) =>
	withName(
		permissionBase.middleware(
			middlewareGen(function* (opts, input: unknown) {
				const { activeOrganizationId } = opts.context.auth.session;

				if (!activeOrganizationId) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "ACTIVE_ORGANIZATION_REQUIRED",
							message:
								"An active organization must be selected to access this resource.",
						}),
					);
				}

				yield* requirePermission({
					entityType: "organization",
					entityId: activeOrganizationId,
					permission,
					userId: opts.context.auth.user.id,
					zedToken: readRevision(opts.context, input),
				});

				return yield* opts.next({
					context: {
						auth: {
							...opts.context.auth,
							session: {
								...opts.context.auth.session,
								activeOrganizationId,
							},
						},
					},
				});
			}),
		),
		`requireOrganizationPermission:${permission}`,
	);
