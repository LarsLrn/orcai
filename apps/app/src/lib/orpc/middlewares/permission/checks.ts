import type { EntityIdFor, EntityType } from "@orcai/spice-db";
import { checkManyEntityPermissions, hasPermission } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/experimental-effect";
import * as Effect from "effect/Effect";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { unique } from "@/lib/utils/array-utils";
import {
	ensurePermission,
	forbiddenPermissionError,
	permissionBase,
} from "./core";
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
		yield* ensurePermission({
			context: opts.context,
			input,
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
			const requestedSet = new Set<string>(requestedIds);

			const relation = yield* checkManyEntityPermissions({
				entityIds: requestedIds,
				entityType,
				permission: input.permission,
				userId: opts.context.auth.user.id,
				zedToken,
			});

			const allowedSet = new Set<string>(
				relation.pairs.flatMap((pair) => {
					const allowed =
						pair.response.oneofKind === "item" &&
						hasPermission({
							permissionship: pair.response.item.permissionship,
						}) === true;
					const requestedId = pair.request?.resource?.objectId;

					return allowed && requestedId && requestedSet.has(requestedId)
						? [
								requestedId,
							]
						: [];
				}),
			);

			const allowedIds = requestedIds.filter((id) => allowedSet.has(id));

			if (allowedIds.length !== requestedIds.length) {
				return yield* Effect.fail(
					forbiddenPermissionError({
						entityType,
						permission: input.permission,
						zedToken,
					}),
				);
			}

			if (allowedIds.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "ENTITY_IDS_REQUIRED",
						message: "No valid entity IDs provided",
					}),
				);
			}

			return yield* opts.next({
				context: {
					allowedIds,
				},
			});
		}),
	);
