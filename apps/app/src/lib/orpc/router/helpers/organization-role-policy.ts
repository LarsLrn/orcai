import type { OrganizationId, OrganizationRole, UserId } from "@orcai/core";
import {
	checkEntityPermission,
	hasPermission,
	type PermissionFor,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

const ADMIN_ROLE = "admin" as const satisfies OrganizationRole;

export const organizationRoleRequiresAdminControl = (
	role: OrganizationRole | null | undefined,
) => role === ADMIN_ROLE;

export const assertCanManageOrganizationAdmins = (params: {
	organizationId: OrganizationId;
	userId: UserId;
}) =>
	checkEntityPermission({
		entityType: "organization",
		entityId: params.organizationId,
		permission: "manage_organization" satisfies PermissionFor<"organization">,
		userId: params.userId,
		zedToken: undefined,
	}).pipe(
		Effect.filterOrFail(
			(result) => hasPermission(result),
			() =>
				new AppErrors.ForbiddenError({
					message: "Managing organization admins requires admin access.",
					data: {
						allowed: false,
						entityType: "organization",
						permission: "manage_organization",
					},
				}),
		),
	);

export const assertAdminRemainsAfterRemoving = (params: {
	adminCount: number;
	removedAdminCount: number;
}) =>
	params.adminCount - params.removedAdminCount > 0
		? Effect.void
		: Effect.fail(
				new AppErrors.BadRequestError({
					message: "At least one organization admin must remain.",
				}),
			);

export const countRemovedAdmins = (params: {
	members: readonly {
		role: OrganizationRole;
		userId: UserId;
	}[];
}) =>
	new Set(
		params.members
			.filter((member) => member.role === ADMIN_ROLE)
			.map((member) => member.userId),
	).size;
