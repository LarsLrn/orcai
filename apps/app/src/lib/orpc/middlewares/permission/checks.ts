import type { EntityIdFor, EntityType } from "@orcai/spice-db";
import { checkManyEntityPermissions, hasPermission } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { withName } from "@/lib/orpc/middlewares/utils";
import { unique } from "@/lib/utils/array-utils";
import {
	ensurePermission,
	forbiddenPermissionError,
	getZedToken,
	permissionBase,
} from "./core";
import type {
	CheckManyPermissionInputFor,
	CheckPermissionInput,
} from "./types";

const normalizeEntityIds = <Entity extends EntityType>(
	entityIds: readonly EntityIdFor<Entity>[],
) => unique(entityIds);

export const checkPermissionMiddleware = withName(
	permissionBase.middleware(
		({ context, next, errors }, input: CheckPermissionInput) =>
			runOrpcEffect(
				ensurePermission({
					context,
					errors,
					input,
				}).pipe(
					Effect.flatMap(() => Effect.promise(() => Promise.resolve(next()))),
				),
			),
	),
	"checkPermission",
);

export const checkManyPermissionMiddleware = <Entity extends EntityType>(
	entityType: Entity,
) =>
	withName(
		permissionBase.middleware(
			({ context, next, errors }, input: CheckManyPermissionInputFor<Entity>) =>
				runOrpcEffect(
					Effect.gen(function* () {
						const zedToken = getZedToken(context, input);
						const requestedIds = normalizeEntityIds(input.entityIds);
						const requestedSet = new Set<string>(requestedIds);

						const relation = yield* checkManyEntityPermissions({
							entityIds: requestedIds,
							entityType,
							permission: input.permission,
							userId: context.auth.user.id,
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
								forbiddenPermissionError(errors, {
									entityType,
									permission: input.permission,
									zedToken,
								}),
							);
						}

						if (allowedIds.length === 0) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message: "No valid entity IDs provided",
									data: {
										allowed: false,
										entityType,
										permission: input.permission,
										zedToken,
									},
								}),
							);
						}

						return yield* Effect.promise(() =>
							Promise.resolve(
								next({
									context: {
										...context,
										allowedIds,
									},
								}),
							),
						);
					}),
				),
		),
		"checkManyPermissions",
	);
