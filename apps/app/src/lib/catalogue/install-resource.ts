import type { BotId, OrganizationId } from "@orcai/core";
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
import { isListed, linkedBlockIds } from "@/lib/catalogue/listing";
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

/**
 * Adds the resource's install scope in the organisation: "added", or
 * "install" or "home" for the scope it had.
 */
const addInstall = (
	resource: ResourceRef,
	organizationId: OrganizationId,
	actor: Actor,
) =>
	Effect.gen(function* () {
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
		if (scope) return scope;
		const db = yield* DB;
		yield* db.insert(dbSchema.resourceScope).values({
			...resource,
			organizationId,
			isPrimary: false,
			assignedBy: actor.userId,
		});
		return "added" as const;
	});

/** The bot's blocks when they are added with it. */
const blocksWith = (resource: ResourceRef, withBlocks: boolean) =>
	withBlocks && resource.resourceType === "bot"
		? linkedBlockIds(resource.resourceId).pipe(
				Effect.map((blockIds) =>
					blockIds.map((blockId) => ({
						resourceType: "block" as const,
						resourceId: blockId,
					})),
				),
			)
		: Effect.succeed([]);

/** The locks for adding the resource, with a bot's blocks when they come along. */
const installLocks = (
	resource: ResourceRef,
	organizationId: OrganizationId,
	withBlocks: boolean,
) =>
	blocksWith(resource, withBlocks).pipe(
		Effect.flatMap((blocks) =>
			resourceOrganizations([
				resource,
				...blocks,
			]),
		),
		Effect.map((organizationIds) => [
			...organizationIds,
			organizationId,
		]),
	);

/** Adds the bot's blocks; a block the organisation is home to is in its library already. */
const addBlocksOf = (
	resource: ResourceRef,
	organizationId: OrganizationId,
	actor: Actor,
) =>
	Effect.gen(function* () {
		let addedBlocks = 0;
		for (const block of yield* blocksWith(resource, true))
			if ((yield* addInstall(block, organizationId, actor)) === "added")
				addedBlocks++;
		return addedBlocks;
	});

/*
 * These run the installer check under the organisations' locks, which role
 * changes take too, so a demotion committed first is seen.
 */

/**
 * Adds a listed bot or block from the catalogue to the organisation: a
 * non-primary scope row, so it joins the organisation's library. With
 * `withBlocks`, a bot's behaviour and repositories join too, each on its
 * own: removing the bot later keeps them. Adding again changes nothing. Its
 * audience there still needs grants.
 */
export const installResource = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	withBlocks: boolean;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { resource, organizationId, actor } = params;
		const { result } = yield* writeRelationships(
			{
				organizationIds: installLocks(
					resource,
					organizationId,
					params.withBlocks,
				),
			},
			Effect.gen(function* () {
				yield* requireInstaller(organizationId, actor);
				const added = yield* addInstall(resource, organizationId, actor);
				if (added === "home")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_HOME_ORGANIZATION",
						message:
							"This organisation is the resource's home; it is already in the library.",
					});
				return {
					changed: added === "added",
					addedBlocks: params.withBlocks
						? yield* addBlocksOf(resource, organizationId, actor)
						: 0,
				};
			}),
		);
		return result;
	});

/**
 * Adds the behaviour and repositories of a bot the organisation added
 * earlier, never the bot itself: when it was removed meanwhile, this fails.
 * Returns how many blocks it added.
 */
export const installBotBlocks = (params: {
	botId: BotId;
	organizationId: OrganizationId;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { organizationId, actor } = params;
		const resource = {
			resourceType: "bot",
			resourceId: params.botId,
		} as const;
		const { result } = yield* writeRelationships(
			{
				organizationIds: installLocks(resource, organizationId, true),
			},
			Effect.gen(function* () {
				yield* requireInstaller(organizationId, actor);
				if (!(yield* lockExistingResource(resource)))
					return yield* new AppErrors.NotFoundError({
						id: resource.resourceId,
						message: "Resource not found",
					});
				if ((yield* scopeIn(resource, organizationId)) !== "install")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_NOT_INSTALLED",
						message:
							"This bot is not added to the organisation; add it from the catalogue first.",
					});
				return yield* addBlocksOf(resource, organizationId, actor);
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
