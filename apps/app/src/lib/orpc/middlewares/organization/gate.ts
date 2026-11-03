import type {
	OrganizationId,
	OrganizationPermission,
	UserId,
} from "@orcai/core";
import { middlewareGen } from "@orpc/effect";
import * as Effect from "effect/Effect";
import { requireOrganizationAccess } from "@/lib/authz/organization-access";
import { readRevision } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { permissionBase } from "@/lib/orpc/middlewares/permission/core";
import { withName } from "@/lib/orpc/middlewares/utils";

/** A fixed permission, or one chosen from the input, e.g. only when acting on another user. */
type PermissionChoice<Input> =
	| OrganizationPermission
	| ((input: Input, userId: UserId) => OrganizationPermission);

const nameOf = <Input>(permission: PermissionChoice<Input>) =>
	typeof permission === "string" ? permission : "byInput";

/**
 * The gate for every procedure that acts in the active organisation: one is
 * selected, the user is a member, and both their committed role and SpiceDB
 * grant the permission (`read` when none is named).
 */
export const requireOrganization = <Input = unknown>(
	permission: PermissionChoice<Input> = "read",
) =>
	withName(
		permissionBase.middleware(
			middlewareGen(function* (opts, input: Input) {
				const { activeOrganizationId } = opts.context.auth.session;
				if (!activeOrganizationId) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "ACTIVE_ORGANIZATION_REQUIRED",
							message:
								"An active organization must be selected to access this resource.",
						}),
					);
				}
				const userId = opts.context.auth.user.id;
				yield* requireOrganizationAccess({
					organizationId: activeOrganizationId,
					userId,
					permission:
						typeof permission === "string"
							? permission
							: permission(input, userId),
					zedToken: readRevision(opts.context, input),
					active: true,
				});
				return yield* opts.next({
					context: {
						auth: {
							...opts.context.auth,
							session: {
								...opts.context.auth.session,
								activeOrganizationId,
							},
						},
					},
				});
			}),
		),
		`requireOrganization:${nameOf(permission)}`,
	);

/** The same gate for an organisation the input names, whichever is active. */
export const requireOrganizationById = (permission: OrganizationPermission) =>
	withName(
		permissionBase.middleware(
			middlewareGen(function* (
				opts,
				input: {
					id: OrganizationId;
				},
			) {
				yield* requireOrganizationAccess({
					organizationId: input.id,
					userId: opts.context.auth.user.id,
					permission,
					zedToken: readRevision(opts.context, input),
					active: input.id === opts.context.auth.session.activeOrganizationId,
				});
				return yield* opts.next();
			}),
		),
		`requireOrganizationById:${permission}`,
	);
