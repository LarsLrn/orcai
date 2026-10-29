import type { BlockId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	RelationshipFact,
	type ResourceRef,
} from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import { revokeIssuedGrants } from "@/lib/authz/resource-access";

/** The resource's installs: its active scopes other than its home. */
const installScopes = (resource: ResourceRef) =>
	and(
		eq(dbSchema.resourceScope.resourceType, resource.resourceType),
		eq(dbSchema.resourceScope.resourceId, resource.resourceId),
		eq(dbSchema.resourceScope.isPrimary, false),
		isNull(dbSchema.resourceScope.endedAt),
	);

/** The organisations that installed the resource, with their names. */
export const installingOrganizations = (resource: ResourceRef) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				id: dbSchema.organization.id,
				name: dbSchema.organization.name,
			})
			.from(dbSchema.resourceScope)
			.innerJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, dbSchema.resourceScope.organizationId),
			)
			.where(installScopes(resource))
			.orderBy(dbSchema.organization.name);
	});

/**
 * Removes the links bots home in the organisations hold to the block, and
 * the block's attachments to their chats, with the tuples of the links.
 */
const unlinkBlock = (
	blockId: BlockId,
	organizationIds: readonly OrganizationId[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const homedThere = db
			.select({
				id: dbSchema.resourceScope.resourceId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, "bot"),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
					inArray(dbSchema.resourceScope.organizationId, [
						...organizationIds,
					]),
				),
			);
		const links = yield* db
			.delete(dbSchema.botBlock)
			.where(
				and(
					eq(dbSchema.botBlock.blockId, blockId),
					inArray(dbSchema.botBlock.botId, homedThere),
				),
			)
			.returning({
				botId: dbSchema.botBlock.botId,
			});
		yield* db.delete(dbSchema.chatBlock).where(
			and(
				eq(dbSchema.chatBlock.blockId, blockId),
				inArray(
					dbSchema.chatBlock.chatId,
					db
						.select({
							id: dbSchema.chat.id,
						})
						.from(dbSchema.chat)
						.where(
							inArray(dbSchema.chat.organizationId, [
								...organizationIds,
							]),
						),
				),
			),
		);
		yield* recordRelationshipFacts(
			...links.map((link) =>
				RelationshipFact.BotBlocksChanged({
					botId: link.botId,
					before: [
						blockId,
					],
					after: [],
				}),
			),
		);
	});

/**
 * Ends the resource's installs, in `organizationIds` or everywhere, with
 * what each organisation built on it: the grants issued there, its bots'
 * links to a block and its chats' attachments of it, and a bot's setup
 * there. The organisations' chats with a bot turn read-only. Call it in a
 * {@link writeRelationships} that holds the resource's organisation locks;
 * returns the organisations whose install ended.
 */
export const endInstalls = (params: {
	resource: ResourceRef;
	organizationIds?: readonly OrganizationId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const ended = yield* db
			.update(dbSchema.resourceScope)
			.set({
				endedAt: params.now,
			})
			.where(
				and(
					installScopes(params.resource),
					params.organizationIds
						? inArray(dbSchema.resourceScope.organizationId, [
								...params.organizationIds,
							])
						: undefined,
				),
			)
			.returning({
				organizationId: dbSchema.resourceScope.organizationId,
			});
		const organizationIds = ended.map((scope) => scope.organizationId);
		if (organizationIds.length === 0) return organizationIds;

		yield* revokeIssuedGrants({
			resource: params.resource,
			organizationIds,
			now: params.now,
		});
		const { resource } = params;
		if (resource.resourceType === "block")
			yield* unlinkBlock(resource.resourceId, organizationIds);
		if (resource.resourceType === "bot")
			yield* db
				.delete(dbSchema.botSetup)
				.where(
					and(
						eq(dbSchema.botSetup.botId, resource.resourceId),
						inArray(dbSchema.botSetup.organizationId, organizationIds),
					),
				);
		return organizationIds;
	});
