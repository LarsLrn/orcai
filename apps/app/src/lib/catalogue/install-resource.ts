import type { OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import * as Effect from "effect/Effect";
import type { ResourceRef } from "@/lib/authz/relationship-facts";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { type Actor, canInstallIn } from "@/lib/authz/resource-authority";
import {
	lockExistingResource,
	resourceOrganizations,
	scopeIn,
} from "@/lib/authz/resource-lifecycle";
import { endInstalls } from "@/lib/catalogue/installs";
import { isListed } from "@/lib/catalogue/listing";
import * as AppErrors from "@/lib/effect/utils/errors";

const requireInstaller = (organizationId: OrganizationId, actor: Actor) =>
	canInstallIn(organizationId, actor).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() =>
				new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message:
						'You do not have the "install_resource" permission in this organisation.',
				}),
		),
	);

/*
 * Both run the installer check under the organisations' locks, which role
 * changes take too, so a demotion committed first is seen.
 */

/**
 * Adds a listed bot or block from the catalogue to the organisation: a
 * non-primary scope row, so it joins the organisation's library. Adding it
 * again changes nothing. Its audience there still needs grants.
 */
export const installResource = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { resource, organizationId, actor } = params;
		const { result } = yield* writeRelationships(
			{
				organizationIds: resourceOrganizations([
					resource,
				]).pipe(
					Effect.map((organizationIds) => [
						...organizationIds,
						organizationId,
					]),
				),
			},
			Effect.gen(function* () {
				yield* requireInstaller(organizationId, params.actor);
				if (!(yield* lockExistingResource(resource)))
					return yield* new AppErrors.NotFoundError({
						id: resource.resourceId,
						message: "Resource not found",
					});
				if (resource.resourceType === "asset" || !(yield* isListed(resource)))
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_NOT_LISTED",
						message: "Only resources listed in the catalogue can be added.",
					});
				const scope = yield* scopeIn(resource, organizationId);
				if (scope === "home")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_HOME_ORGANIZATION",
						message:
							"This organisation is the resource's home; it is already in the library.",
					});
				if (scope === "install") return false;
				const db = yield* DB;
				yield* db.insert(dbSchema.resourceScope).values({
					...resource,
					organizationId,
					isPrimary: false,
					assignedBy: actor.userId,
				});
				return true;
			}),
		);
		return result;
	});

/**
 * Removes a resource added from the catalogue from the organisation, with
 * what the organisation built on it ({@link endInstalls}). Removing it again
 * changes nothing; the home organisation cannot remove its own resource.
 */
export const uninstallResource = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { resource, organizationId } = params;
		const { result } = yield* writeRelationships(
			{
				organizationIds: resourceOrganizations([
					resource,
				]),
			},
			Effect.gen(function* () {
				yield* requireInstaller(organizationId, params.actor);
				if (!(yield* lockExistingResource(resource)))
					return yield* new AppErrors.NotFoundError({
						id: resource.resourceId,
						message: "Resource not found",
					});
				if ((yield* scopeIn(resource, organizationId)) === "home")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_HOME_ORGANIZATION",
						message:
							"This organisation is the resource's home; delete it instead.",
					});
				const ended = yield* endInstalls({
					resource,
					organizationIds: [
						organizationId,
					],
					now: new Date(),
				});
				return ended.length > 0;
			}),
		);
		return result;
	});
