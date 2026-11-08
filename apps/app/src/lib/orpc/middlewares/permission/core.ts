import type { AuthzEntityType, UserId } from "@orcai/core";
import { checkEntityPermission } from "@orcai/spice-db";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import { permissionDenied } from "@/lib/authz/permission-denied";
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

/** Fails with `permissionDenied` unless the user holds the permission. */
export const requirePermission = <Entity extends AuthzEntityType>(
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
