import { v1 } from "@authzed/authzed-node";
import { os } from "@orpc/server";
import { z } from "zod/v4";
import type { authClient } from "@/lib/auth-client";
import { checkManyRelations, checkRelation } from "@/lib/spice-db/actions";
import type { Action, EntityType } from "@/lib/spice-db/types";

const base = os
	.$context<{ session: typeof authClient.$Infer.Session }>()
	.errors({
		FORBIDDEN: {
			data: z.object({ allowed: z.boolean() }),
		},
	});

export const checkPermissionMiddleware = base.middleware(
	async (
		{ context, next, errors },
		input: {
			entityId: string;
			action: Action;
			entityType: EntityType;
		},
	) => {
		const { entityId, action, entityType } = input;

		const relation = await checkRelation({
			entityId: entityId,
			entityType,
			action,
			userId: context.session.user.id,
		});

		if (
			relation.permissionship !==
			v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
		) {
			throw errors.FORBIDDEN({
				data: {
					allowed: false,
				},
			});
		}

		return next();
	},
);

export const checkManyPermissionMiddleware = base.middleware(
	async (
		{ context, next, errors },
		input: {
			entityIds: string[];
			action: Action;
			entityType: EntityType;
		},
	) => {
		const { entityIds, action, entityType } = input;

		const relation = await checkManyRelations({
			entityIds,
			entityType,
			action,
			userId: context.session.user.id,
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
				},
			});
		}

		return next({ context: { ...context, allowedIds } });
	},
);
