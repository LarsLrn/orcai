import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import type { authClient } from "@/lib/auth/auth-client";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";
import type { ResourceGrantRole } from "@/lib/orpc/schemas/resource";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@/lib/orpc/schemas/resource";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
} from "@/lib/spice-db/client";
import type {
	EntityType,
	PermissionFor,
	ResourceType,
} from "@/lib/spice-db/types";
import { unique } from "@/lib/utils/array-utils";
import { withName } from "./utils";

export type CheckPermissionInput = {
	[Entity in EntityType]: {
		entityId: string;
		permission: PermissionFor<Entity>;
		entityType: Entity;
		zedToken?: string;
	};
}[EntityType];

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
				checkEntityPermission({
					entityId: input.entityId,
					entityType: input.entityType,
					permission: input.permission,
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
									entityType: input.entityType,
									permission: input.permission,
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

export type CheckManyPermissionInput = {
	[Entity in EntityType]: {
		entityIds: string[];
		permission: PermissionFor<Entity>;
		entityType: Entity;
		zedToken?: string;
	};
}[EntityType];

export const checkManyPermissionMiddleware = withName(
	permissionBase.middleware(
		({ context, next, errors }, input: CheckManyPermissionInput) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const zedToken = input.zedToken ?? context.meta?.zedToken;

					// Normalize to unique IDs so checks are deterministic.
					const requestedIds = unique(input.entityIds);
					const requestedSet = new Set(requestedIds);

					const relation = yield* checkManyEntityPermissions({
						entityIds: requestedIds,
						entityType: input.entityType,
						permission: input.permission,
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
									entityType: input.entityType,
									permission: input.permission,
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
									entityType: input.entityType,
									permission: input.permission,
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

export interface AssertCanGrantPrincipalInput {
	resourceType: ResourceType;
	resourceId: string;
	principalType: "user" | "group";
	principalId: string;
	role: ResourceGrantRole;
	zedToken?: string;
}

export const assertCanGrantPrincipalMiddleware = withName(
	permissionBase.middleware(
		({ context, next, errors }, input: AssertCanGrantPrincipalInput) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const db = yield* DB;
					const zedToken = input.zedToken ?? context.meta?.zedToken;

					const relation = yield* checkEntityPermission({
						entityId: input.resourceId,
						entityType: input.resourceType,
						permission: "manage_access",
						userId: context.auth.user.id,
						zedToken,
					});

					const canManageAccess =
						relation.permissionship ===
						v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;

					if (!canManageAccess) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								data: {
									allowed: false,
									entityType: input.resourceType,
									permission: "manage_access",
									zedToken,
								},
							}),
						);
					}

					const resourceScopes = yield* db.query.resourceScope.findMany({
						columns: {
							organizationId: true,
						},
						where: {
							AND: [
								{ resourceType: input.resourceType },
								{ resourceId: input.resourceId },
								{ endedAt: { isNull: true } },
							],
						},
					});

					if (resourceScopes.length === 0) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message:
									"[RESOURCE_SCOPE_REQUIRED] Resource has no active organization scope and cannot be shared",
								data: {
									allowed: false,
									entityType: input.resourceType,
									permission: "manage_access",
									zedToken,
								},
							}),
						);
					}

					const orgIds = resourceScopes.map((scope) => scope.organizationId);
					if (input.principalType === "user") {
						const membership = yield* db.query.member.findFirst({
							columns: {
								userId: true,
							},
							where: {
								AND: [
									{ organizationId: { in: orgIds } },
									{ userId: input.principalId },
								],
							},
						});

						if (!membership) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message:
										"[CROSS_ORG_PRINCIPAL_FORBIDDEN] User principal must belong to the resource organization scope",
									data: {
										code: "CROSS_ORG_PRINCIPAL_FORBIDDEN",
									},
								}),
							);
						}
					}

					if (input.principalType === "group") {
						const group = yield* db.query.group.findFirst({
							columns: {
								organizationId: true,
								kind: true,
								systemKey: true,
							},
							where: {
								AND: [
									{ id: input.principalId },
									{ organizationId: { in: orgIds } },
									{ deletedAt: { isNull: true } },
								],
							},
						});

						if (!group) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message:
										"[CROSS_ORG_PRINCIPAL_FORBIDDEN] Group principal must belong to the resource organization scope",
									data: {
										code: "CROSS_ORG_PRINCIPAL_FORBIDDEN",
									},
								}),
							);
						}

						if (
							group.kind === "system" &&
							group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY &&
							input.role !== "viewer"
						) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message:
										"[ALL_MEMBERS_VIEWER_ONLY] All Members group can only receive viewer grants",
									data: {
										code: "ALL_MEMBERS_VIEWER_ONLY",
									},
								}),
							);
						}
					}

					return yield* Effect.promise(() => Promise.resolve(next()));
				}),
			),
	),
	"assertCanGrantPrincipal",
);
