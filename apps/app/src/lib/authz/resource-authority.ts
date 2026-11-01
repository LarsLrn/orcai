import {
	ORGANIZATION_ROLE_PERMISSIONS,
	ORGANIZATION_ROLES,
	type OrganizationId,
	type OrganizationPermission,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { checkEntityPermission } from "@orcai/spice-db";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { ResourceRef } from "@/lib/authz/relationship-facts";
import { scopeIn } from "@/lib/authz/resource-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";

export type Actor = {
	userId: UserId;
	zedToken: string | undefined;
};

/** Whether the user may add from the catalogue to the organisation and remove what was added. */
const adderRoles = ORGANIZATION_ROLES.filter((role) =>
	(
		ORGANIZATION_ROLE_PERMISSIONS[role] as readonly OrganizationPermission[]
	).includes("add_from_catalogue"),
);

/**
 * Whether the user may add from the catalogue to the organisation and remove
 * what was added: SpiceDB `add_from_catalogue`, and a committed role that holds
 * it, so a demotion counts before its tuples arrive.
 */
export const canAddIn = (organizationId: OrganizationId, actor: Actor) =>
	Effect.gen(function* () {
		const [permitted, [membership]] = yield* Effect.all(
			[
				checkEntityPermission({
					entityType: "organization",
					entityId: organizationId,
					permission: "add_from_catalogue",
					userId: actor.userId,
					zedToken: actor.zedToken,
				}),
				(yield* DB)
					.select({
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, actor.userId),
							inArray(dbSchema.member.role, adderRoles),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);
		return permitted && membership !== undefined;
	});

/**
 * Whether the user administers the resource in the organisation: with
 * `homePermission` on it in its home, with `add_from_catalogue` where it is
 * added. Adders share it there and set a bot's setup, but never edit
 * its definition.
 */
export const administersIn = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	homePermission: "edit" | "manage_access";
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { resource, actor } = params;
		switch (yield* scopeIn(resource, params.organizationId)) {
			case "home":
				return yield* checkEntityPermission({
					entityType: resource.resourceType,
					entityId: resource.resourceId,
					permission: params.homePermission,
					userId: actor.userId,
					zedToken: actor.zedToken,
				});
			case "added":
				return yield* canAddIn(params.organizationId, actor);
			case undefined:
				return false;
		}
	});

/** Fails unless the user administers the resource in the organisation ({@link administersIn}). */
export const requireAdministersIn = (
	params: Parameters<typeof administersIn>[0],
) =>
	administersIn(params).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() =>
				new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message: `You do not have the "${params.homePermission}" permission on this ${params.resource.resourceType} in this organisation, nor "add_from_catalogue" where it was added from the catalogue.`,
				}),
		),
		Effect.asVoid,
	);
