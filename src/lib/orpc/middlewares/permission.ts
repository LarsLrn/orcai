import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import type { authClient } from "@/lib/auth-client";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";
import { checkManyRelations, checkRelation } from "@/lib/spice-db/actions";
import type { Action, EntityType } from "@/lib/spice-db/types";
import { withName } from "./utils";

export interface CheckPermissionInput {
	entityId: string;
	action: Action;
	entityType: EntityType;
	zedToken?: string;
}

const permissionBase = os.$context<{
	auth: {
		isAuthenticated: true;
		session: typeof authClient.$Infer.Session.session;
		user: typeof authClient.$Infer.Session.user;
	};
	meta?: {
		zedToken?: string;
	};
}>();

export const checkPermissionMiddleware = withName(
	permissionBase.middleware(
		({ context, next, errors }, input: CheckPermissionInput) =>
			runOrpcEffect(
				checkRelation({
					entityId: input.entityId,
					entityType: input.entityType,
					action: input.action,
					userId: context.auth.user.id,
					zedToken: input.zedToken ?? context.meta?.zedToken,
				}).pipe(
					Effect.filterOrFail(
						(relation) =>
							relation.permissionship ===
							v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION,
						() =>
							errors.FORBIDDEN({
								data: {
									allowed: false,
									action: input.action,
									entityType: input.entityType,
									zedToken: input.zedToken ?? context.meta?.zedToken,
								},
							}),
					),
					Effect.flatMap(() => Effect.promise(() => Promise.resolve(next()))),
				),
			),
	),
	"checkPermission",
);

export interface CheckManyPermissionInput {
	entityIds: string[];
	action: Action;
	entityType: EntityType;
	zedToken?: string;
}

export const checkManyPermissionMiddleware = withName(
	permissionBase.middleware(
		({ context, next, errors }, input: CheckManyPermissionInput) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const zedToken = input.zedToken ?? context.meta?.zedToken;

					// Normalize to unique IDs so checks are deterministic.
					const requestedIds = Array.from(new Set(input.entityIds));
					const requestedSet = new Set(requestedIds);

					const relation = yield* checkManyRelations({
						entityIds: requestedIds,
						entityType: input.entityType,
						action: input.action,
						userId: context.auth.user.id,
						zedToken,
					});

					const allowedSet = new Set(
						relation.pairs
							.map((pair) => {
								const allowed =
									pair.response.oneofKind === "item" &&
									pair.response.item.permissionship ===
										v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;

								const id = pair.request?.resource?.objectId;
								return allowed && id && requestedSet.has(id) ? id : undefined;
							})
							.filter((id): id is string => id !== undefined),
					);

					const allowedIds = requestedIds.filter((id) => allowedSet.has(id));

					if (allowedIds.length !== requestedIds.length) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								data: {
									allowed: false,
									action: input.action,
									entityType: input.entityType,
									zedToken,
								},
							}),
						);
					}

					if (allowedIds.length === 0) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "No valid entity IDs provided",
								data: {
									allowed: false,
									action: input.action,
									entityType: input.entityType,
									zedToken,
								},
							}),
						);
					}

					return yield* Effect.promise(() =>
						Promise.resolve(next({ context: { ...context, allowedIds } })),
					);
				}),
			),
	),
	"checkManyPermissions",
);
