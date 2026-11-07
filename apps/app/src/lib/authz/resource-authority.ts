import type { OrganizationId, UserId } from "@orcai/core";
import type { ReadRevision } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { permittedIds } from "@/lib/authz/content-access";
import { organizationPermitted } from "@/lib/authz/organization-access";
import type { ResourceRef } from "@/lib/authz/relationship-facts";
import { scopeIn } from "@/lib/authz/resource-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";

export type Actor = {
	userId: UserId;
	zedToken: ReadRevision | undefined;
};

/**
 * Whether the user may add from the catalogue to the organisation and remove
 * what was added, by their committed role and in SpiceDB.
 */
export const canAddIn = (organizationId: OrganizationId, actor: Actor) =>
	organizationPermitted({
		organizationId,
		userId: actor.userId,
		permission: "add_from_catalogue",
		zedToken: actor.zedToken,
	});

/**
 * Whether the user administers the resource in the organisation: with
 * `homePermission` on it in its home, in SpiceDB and by committed state, with `add_from_catalogue` where it is
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
				return (yield* permittedIds(
					resource.resourceType,
					[
						resource.resourceId,
					],
					actor,
					params.homePermission,
				)).has(resource.resourceId);
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
