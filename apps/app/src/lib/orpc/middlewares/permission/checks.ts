import type { EntityIdFor, EntityType } from "@orcai/spice-db";
import { permittedEntityIds } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/experimental-effect";
import * as Effect from "effect/Effect";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { unique } from "@/lib/utils/array-utils";
import { permissionBase, permissionDenied, requirePermission } from "./core";
import type {
	CheckManyPermissionInputFor,
	CheckPermissionInput,
} from "./types";

const normalizeEntityIds = <Entity extends EntityType>(
	entityIds: readonly EntityIdFor<Entity>[],
) => unique(entityIds);

// Named on the generator: `adaptInput` copies that name, not a decorated one.
export const checkPermissionMiddleware = permissionBase.middleware(
	middlewareGen(function* checkPermission(opts, input: CheckPermissionInput) {
		yield* requirePermission({
			...input,
			userId: opts.context.auth.user.id,
			zedToken: getZedToken(opts.context, input),
		});
		return yield* opts.next();
	}),
);

export const checkManyPermissionMiddleware = <Entity extends EntityType>(
	entityType: Entity,
) =>
	permissionBase.middleware(
		middlewareGen(function* checkManyPermissions(
			opts,
			input: CheckManyPermissionInputFor<Entity>,
		) {
			const zedToken = getZedToken(opts.context, input);
			const requestedIds = normalizeEntityIds(input.entityIds);

			const permittedIds = yield* permittedEntityIds({
				entityIds: requestedIds,
				entityType,
				permission: input.permission,
				userId: opts.context.auth.user.id,
				zedToken,
			});

			if (requestedIds.some((id) => !permittedIds.has(id))) {
				return yield* Effect.fail(
					permissionDenied({
						entityType,
						permission: input.permission,
						zedToken,
					}),
				);
			}

			if (requestedIds.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "ENTITY_IDS_REQUIRED",
						message: "No valid entity IDs provided",
					}),
				);
			}

			return yield* opts.next({
				context: {
					allowedIds: requestedIds,
				},
			});
		}),
	);
