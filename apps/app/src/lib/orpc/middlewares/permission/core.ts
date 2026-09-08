import { checkEntityPermission, hasPermission } from "@orcai/spice-db";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import type { AuthContext } from "@/lib/orpc/middlewares/auth";
import type { CheckPermissionInput, PermissionContext } from "./types";

export const permissionBase = os.$context<
	AuthContext & {
		meta?: {
			zedToken?: string;
		};
	}
>();

export const forbiddenPermissionError = (params: {
	entityType: CheckPermissionInput["entityType"];
	permission: string;
	zedToken?: string;
}) =>
	new AppErrors.ForbiddenError({
		data: {
			allowed: false,
			entityType: params.entityType,
			permission: params.permission,
			zedToken: params.zedToken,
		},
	});

export const ensurePermission = (params: {
	context: PermissionContext;
	input: CheckPermissionInput;
}) => {
	const zedToken = getZedToken(params.context, params.input);

	return checkEntityPermission({
		entityId: params.input.entityId,
		entityType: params.input.entityType,
		permission: params.input.permission,
		userId: params.context.auth.user.id,
		zedToken,
	}).pipe(
		Effect.filterOrFail(
			({ permissionship }) =>
				hasPermission({
					permissionship,
				}),
			() =>
				forbiddenPermissionError({
					entityType: params.input.entityType,
					permission: params.input.permission,
					zedToken,
				}),
		),
	);
};
