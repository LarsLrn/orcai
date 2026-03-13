import * as Effect from "effect/Effect";
import type { authClient } from "@/lib/auth/auth-client";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";
import { checkEntityPermission, hasPermission } from "@/lib/spice-db/client";
import type { PermissionFor } from "@/lib/spice-db/types";
import { withName } from "./utils";

type OrganizationPermission = PermissionFor<"organization">;

const organizationPermissionBase = os.$context<{
	auth: {
		isAuthenticated: true;
		session: typeof authClient.$Infer.Session.session;
		user: typeof authClient.$Infer.Session.user;
	};
	meta?: {
		zedToken?: string;
	};
}>();

export const requireOrganizationPermission = (
	permission: OrganizationPermission,
) =>
	withName(
		organizationPermissionBase.middleware(({ context, errors, next }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const organizationId = context.auth.session.activeOrganizationId;

					if (!organizationId) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message:
									"An active organization must be selected to access this resource.",
							}),
						);
					}

					const permissionCheck = yield* checkEntityPermission({
						entityId: organizationId,
						entityType: "organization",
						permission,
						userId: context.auth.user.id,
						zedToken: context.meta?.zedToken,
					});

					if (hasPermission(permissionCheck) === false) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								data: {
									allowed: false,
									permission,
									entityType: "organization",
									zedToken: context.meta?.zedToken,
								},
							}),
						);
					}

					return next({
						context: {
							auth: {
								...context.auth,
								session: {
									...context.auth.session,
									activeOrganizationId: organizationId,
								},
							},
						},
					});
				}),
			),
		),
		`requireOrganizationPermission:${permission}`,
	);
