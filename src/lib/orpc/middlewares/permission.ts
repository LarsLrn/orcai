import { v1 } from "@authzed/authzed-node";
import type { authClient } from "@/lib/auth-client";
import { os } from "@/lib/orpc/implementation/base";
import { checkManyRelations, checkRelation } from "@/lib/spice-db/actions";
import type { Action, EntityType } from "@/lib/spice-db/types";
import { withName } from "./utils";

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
		async (
			{ context, next, errors },
			input: {
				entityId: string;
				action: Action;
				entityType: EntityType;
				zedToken?: string;
			},
		) => {
			const { entityId, action, entityType } = input;

			const zedToken = input.zedToken ?? context.meta?.zedToken;

			const relation = await checkRelation({
				entityId: entityId,
				entityType,
				action,
				userId: context.auth.user.id,
				zedToken,
			});

			if (
				relation.permissionship !==
				v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			) {
				throw errors.FORBIDDEN({
					data: {
						allowed: false,
						action,
						entityType,
						zedToken,
					},
				});
			}

			return next();
		},
	),
	"checkPermission",
);

export const checkManyPermissionMiddleware = withName(
	permissionBase.middleware(
		async (
			{ context, next, errors },
			input: {
				entityIds: string[];
				action: Action;
				entityType: EntityType;
				zedToken?: string;
			},
		) => {
			const { entityIds, action, entityType } = input;

			const zedToken = input.zedToken || context.meta?.zedToken;

			const relation = await checkManyRelations({
				entityIds,
				entityType,
				action,
				userId: context.auth.user.id,
				zedToken,
			});

			const allowedIds = relation.pairs
				.map((pair) => {
					if (
						pair.response.oneofKind === "item" &&
						pair.response.item.permissionship ===
							v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
					) {
						return pair.request?.resource?.objectId;
					}
					return null;
				})
				.filter((id): id is string => id !== null);

			if (allowedIds.length === 0 || allowedIds.length !== entityIds.length) {
				throw errors.FORBIDDEN({
					data: {
						allowed: false,
						action,
						entityType,
						zedToken,
					},
				});
			}

			return next({ context: { ...context, allowedIds } });
		},
	),
	"checkManyPermissions",
);
