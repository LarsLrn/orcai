import type { UserId } from "@orcai/core";
import { checkEntityPermission, type EntityType } from "@orcai/spice-db";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import type { AppEffectContext } from "@/lib/orpc/implementation/os";
import type { AuthContext } from "@/lib/orpc/middlewares/auth";
import type { CheckPermissionInputFor } from "./types";

export const permissionBase = os.$context<
	AppEffectContext &
		AuthContext & {
			meta?: {
				zedToken?: string;
			};
		}
>();

/** The denial every permission check fails with; the message is what the assistant's model reads. */
export const permissionDenied = (params: {
	entityType: EntityType;
	permission: string;
	zedToken?: string;
}) =>
	new AppErrors.ForbiddenError({
		reason: "PERMISSION_DENIED",
		message: `You do not have the "${params.permission}" permission on this ${params.entityType}.`,
		data: {
			entityType: params.entityType,
			permission: params.permission,
			zedToken: params.zedToken,
		},
	});

/** Fails with `permissionDenied` unless the user holds the permission. */
export const requirePermission = <Entity extends EntityType>(
	check: CheckPermissionInputFor<Entity> & {
		userId: UserId;
	},
) =>
	checkEntityPermission(check).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() => permissionDenied(check),
		),
		Effect.asVoid,
	);
