import type { BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import * as Effect from "effect/Effect";
import type { ResourceRef } from "@/lib/authz/relationship-facts";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { type Actor, canAddIn } from "@/lib/authz/resource-authority";
import {
	lockExistingResource,
	resourceOrganizations,
	scopeIn,
} from "@/lib/authz/resource-lifecycle";
import { endAddedScopes } from "@/lib/catalogue/added-scopes";
import { isListed, linkedBlockIds } from "@/lib/catalogue/listing";
import * as AppErrors from "@/lib/effect/utils/errors";

const requireAdder = (organizationId: OrganizationId, actor: Actor) =>
	canAddIn(organizationId, actor).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() =>
				new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message:
						'You do not have the "add_from_catalogue" permission in this organisation.',
				}),
		),
	);

/**
 * Adds the resource's added scope in the organisation: "new", or
 * "added" or "home" for the scope it had.
 */
const addScope = (
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
		return "new" as const;
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
const addLocks = (
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
			if ((yield* addScope(block, organizationId, actor)) === "new")
				addedBlocks++;
		return addedBlocks;
	});

/*
 * These run the adder check under the organisations' locks, which role
 * changes take too, so a demotion committed first is seen.
 */

/**
 * Adds a listed bot or block from the catalogue to the organisation: a
 * non-primary scope row, so it joins the organisation's library. With
 * `withBlocks`, a bot's behaviour and repositories join too, each on its
 * own: removing the bot later keeps them. Adding again changes nothing. Its
 * audience there still needs grants.
 */
export const addResource = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	withBlocks: boolean;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const { resource, organizationId, actor } = params;
		const { result } = yield* writeRelationships(
			{
				organizationIds: addLocks(resource, organizationId, params.withBlocks),
			},
			Effect.gen(function* () {
				yield* requireAdder(organizationId, actor);
				const scope = yield* addScope(resource, organizationId, actor);
				if (scope === "home")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_HOME_ORGANIZATION",
						message:
							"This organisation is the resource's home; it is already in the library.",
					});
				return {
					changed: scope === "new",
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
export const addBotBlocks = (params: {
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
				organizationIds: addLocks(resource, organizationId, true),
			},
			Effect.gen(function* () {
				yield* requireAdder(organizationId, actor);
				if (!(yield* lockExistingResource(resource)))
					return yield* new AppErrors.NotFoundError({
						id: resource.resourceId,
						message: "Resource not found",
					});
				if ((yield* scopeIn(resource, organizationId)) !== "added")
					return yield* new AppErrors.BadRequestError({
						reason: "RESOURCE_NOT_ADDED",
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
 * what the organisation built on it ({@link endAddedScopes}). Removing it again
 * changes nothing; the home organisation cannot remove its own resource.
 */
export const removeResource = (params: {
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
				yield* requireAdder(organizationId, params.actor);
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
				const ended = yield* endAddedScopes({
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
