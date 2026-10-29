import {
	type AssetId,
	type BlockId,
	type BotId,
	buckets,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { deletePointsByIdentifier } from "@orcai/qdrant";
import {
	deletePrefixRecursively,
	sendDeleteObjectCommand,
} from "@orcai/s3/server";
import type { ResourceType } from "@orcai/spice-db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import {
	RelationshipFact,
	type ResourceRef,
} from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	grantPrincipal,
	scopedResourceRef,
} from "@/lib/authz/scoped-resource-id";

type ResourceVisibility =
	typeof dbSchema.resourceVisibility.$inferSelect.visibility;

/**
 * Records a new resource's organization scope, visibility and owner. Call it
 * in the {@link writeRelationships} that inserts the resource row.
 */
export const initializeResourceAuthorization = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	ownerUserId: UserId;
	visibility?: ResourceVisibility;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const visibility = params.visibility ?? "private";

		yield* db.insert(dbSchema.resourceScope).values({
			...params.resource,
			organizationId: params.organizationId,
			isPrimary: true,
			assignedAt: now,
			assignedBy: params.ownerUserId,
			endedAt: null,
		});

		yield* db.insert(dbSchema.resourceVisibility).values({
			...params.resource,
			visibility,
			updatedBy: params.ownerUserId,
			updatedAt: now,
		});

		yield* recordRelationshipFacts(
			RelationshipFact.ResourceCreated({
				resource: params.resource,
				ownerId: params.ownerUserId,
				visibility,
			}),
		);
	});

const resourceTables = {
	bot: dbSchema.bot,
	block: dbSchema.block,
	asset: dbSchema.asset,
};

const groupLinks = <Parent extends string, Child extends string>(
	links: readonly {
		parent: Parent;
		child: Child;
	}[],
) => {
	const children = new Map<Parent, Child[]>();
	for (const link of links)
		children.set(link.parent, [
			...(children.get(link.parent) ?? []),
			link.child,
		]);
	return [
		...children,
	];
};

/**
 * Whether the resource row still exists, locked against its deletion until the
 * transaction ends.
 */
export const lockExistingResource = (resource: ResourceRef) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const table = resourceTables[resource.resourceType];
		const rows = yield* db
			.select({
				id: table.id,
			})
			.from(table)
			.where(
				inArray(table.id, [
					resource.resourceId,
				] as (typeof table.id._.data)[]),
			)
			.for("key share");
		return rows.length > 0;
	});

/** The link facts that unlink the resources from bots, blocks and chats. */
const readLinkFacts = (resourceType: ResourceType, ids: readonly string[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		switch (resourceType) {
			case "bot": {
				const botIds = ids as BotId[];
				const botBlocks = yield* db
					.select({
						parent: dbSchema.botBlock.botId,
						child: dbSchema.botBlock.blockId,
					})
					.from(dbSchema.botBlock)
					.where(inArray(dbSchema.botBlock.botId, botIds));
				const chats = yield* db
					.select({
						chatId: dbSchema.chat.id,
						botId: dbSchema.chat.botId,
					})
					.from(dbSchema.chat)
					.where(inArray(dbSchema.chat.botId, botIds));
				return [
					...groupLinks(botBlocks).map(([parent, children]) =>
						RelationshipFact.BotBlocksChanged({
							botId: parent,
							before: children,
							after: [],
						}),
					),
					...chats.flatMap((chat) =>
						chat.botId
							? [
									RelationshipFact.ChatBotUnlinked({
										chatId: chat.chatId,
										botId: chat.botId,
									}),
								]
							: [],
					),
				];
			}
			case "block": {
				const blockIds = ids as BlockId[];
				const botBlocks = yield* db
					.select({
						parent: dbSchema.botBlock.botId,
						child: dbSchema.botBlock.blockId,
					})
					.from(dbSchema.botBlock)
					.where(inArray(dbSchema.botBlock.blockId, blockIds));
				const blockAssets = yield* db
					.select({
						parent: dbSchema.blockAsset.blockId,
						child: dbSchema.blockAsset.assetId,
					})
					.from(dbSchema.blockAsset)
					.where(inArray(dbSchema.blockAsset.blockId, blockIds));
				return [
					...groupLinks(botBlocks).map(([parent, children]) =>
						RelationshipFact.BotBlocksChanged({
							botId: parent,
							before: children,
							after: [],
						}),
					),
					...groupLinks(blockAssets).map(([parent, children]) =>
						RelationshipFact.BlockAssetsChanged({
							blockId: parent,
							before: children,
							after: [],
						}),
					),
				];
			}
			case "asset": {
				const blockAssets = yield* db
					.select({
						parent: dbSchema.blockAsset.blockId,
						child: dbSchema.blockAsset.assetId,
					})
					.from(dbSchema.blockAsset)
					.where(inArray(dbSchema.blockAsset.assetId, ids as AssetId[]));
				return groupLinks(blockAssets).map(([parent, children]) =>
					RelationshipFact.BlockAssetsChanged({
						blockId: parent,
						before: children,
						after: [],
					}),
				);
			}
		}
	});

/**
 * Removes the resources' grants, visibility and scope rows, the inverse of
 * {@link initializeResourceAuthorization}, and records the facts that remove
 * their tuples. Runs before the resource rows go, so the links are still there to read.
 */
const teardownResourceAuthorization = (params: {
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const table = resourceTables[params.resourceType];
		const resourceIds = [
			...params.resourceIds,
		];

		const owners = yield* db
			.select({
				resourceId: table.id,
				userId: table.userId,
			})
			.from(table)
			.where(inArray(table.id, resourceIds as (typeof table.id._.data)[]));
		const linkFacts = yield* readLinkFacts(params.resourceType, resourceIds);
		const grants = yield* db
			.select({
				resourceId: dbSchema.resourceGrant.resourceId,
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
				role: dbSchema.resourceGrant.role,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, params.resourceType),
					inArray(dbSchema.resourceGrant.resourceId, resourceIds),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		for (const scoped of [
			dbSchema.resourceGrant,
			dbSchema.resourceVisibility,
			dbSchema.resourceScope,
		])
			yield* db
				.delete(scoped)
				.where(
					and(
						eq(scoped.resourceType, params.resourceType),
						inArray(scoped.resourceId, resourceIds),
					),
				);

		const ref = (resourceId: string) =>
			scopedResourceRef({
				resourceType: params.resourceType,
				resourceId,
			});

		yield* recordRelationshipFacts(
			...owners.map((owner) =>
				RelationshipFact.ResourceDeleted({
					resource: ref(owner.resourceId),
					ownerId: owner.userId,
				}),
			),
			...grants.map((grant) =>
				RelationshipFact.ResourceGrantChanged({
					resource: ref(grant.resourceId),
					principal: grantPrincipal(grant),
					ended: [
						grant.role,
					],
					held: [],
				}),
			),
			...linkFacts,
		);
	});

/** Whether the organisation is the resource's home, has it installed, or neither. */
export const scopeIn = (
	resource: ResourceRef,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [scope] = yield* db
			.select({
				isPrimary: dbSchema.resourceScope.isPrimary,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, resource.resourceType),
					eq(dbSchema.resourceScope.resourceId, resource.resourceId),
					eq(dbSchema.resourceScope.organizationId, organizationId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
		if (!scope) return undefined;
		return scope.isPrimary ? ("home" as const) : ("install" as const);
	});

/** The organizations the resources are scoped to, whose write locks guard them. */
export const resourceOrganizations = (
	resources: readonly {
		resourceType: ResourceType;
		resourceId: string;
	}[],
) =>
	Effect.gen(function* () {
		if (resources.length === 0) return [] as OrganizationId[];
		const db = yield* DB;
		const rows = yield* db
			.selectDistinct({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					inArray(
						dbSchema.resourceScope.resourceType,
						Arr.dedupe(resources.map((resource) => resource.resourceType)),
					),
					inArray(
						dbSchema.resourceScope.resourceId,
						resources.map((resource) => resource.resourceId),
					),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
		return rows.map((row) => row.organizationId);
	});

/**
 * Deletes resource rows with their authorization state, recording the facts
 * that remove their tuples. Call it in a {@link writeRelationships} that
 * holds the resources' organisation locks; pass the result to
 * {@link removeDeletedResourceData} after the commit.
 */
export const deleteResources = (params: {
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const table = resourceTables[params.resourceType];
		const ids = [
			...params.resourceIds,
		] as (typeof table.id._.data)[];
		if (ids.length === 0) return emptyDeletedData;

		// Waits for chats being created with a bot, and keeps new ones out until commit.
		yield* db
			.select({
				id: table.id,
			})
			.from(table)
			.where(inArray(table.id, ids))
			.for("update");
		const indexedLinks =
			params.resourceType === "block"
				? yield* db
						.select({
							blockId: dbSchema.blockAsset.blockId,
							assetId: dbSchema.blockAsset.assetId,
						})
						.from(dbSchema.blockAsset)
						.where(inArray(dbSchema.blockAsset.blockId, ids as BlockId[]))
				: [];
		const files =
			params.resourceType === "asset"
				? yield* db
						.select({
							id: dbSchema.asset.id,
							bucket: dbSchema.asset.bucket,
							prefix: dbSchema.asset.prefix,
							fileType: dbSchema.asset.fileType,
						})
						.from(dbSchema.asset)
						.where(inArray(dbSchema.asset.id, ids as AssetId[]))
				: [];
		yield* teardownResourceAuthorization(params);
		// Their chats lose the bot link with the row, so they keep why they turned read-only.
		if (params.resourceType === "bot") {
			yield* db
				.update(dbSchema.chat)
				.set({
					botDeletedAt: new Date(),
				})
				.where(inArray(dbSchema.chat.botId, ids as BotId[]));
		}
		yield* db.delete(table).where(inArray(table.id, ids));
		return {
			indexedLinks,
			files,
		};
	});

type DeletedData = Effect.Success<ReturnType<typeof deleteResources>>;

const emptyDeletedData = {
	indexedLinks: [] as {
		blockId: BlockId;
		assetId: AssetId;
	}[],
	files: [] as {
		id: AssetId;
		bucket: string;
		prefix: string;
		fileType: string;
	}[],
};

/** Removes the stored files and search points of deleted resources. */
export const removeDeletedResourceData = (deleted: readonly DeletedData[]) =>
	Effect.all(
		[
			Effect.forEach(
				deleted.flatMap((data) => data.files),
				(asset) =>
					Effect.all([
						sendDeleteObjectCommand({
							bucket: asset.bucket,
							key: `${asset.prefix}/${asset.id}.${asset.fileType}`,
						}),
						deletePointsByIdentifier({
							assetId: asset.id,
							blockId: undefined,
						}),
						deletePrefixRecursively({
							bucket: buckets.processed.name,
							prefix: `${asset.id}/`,
						}),
					]),
				{
					concurrency: 5,
					discard: true,
				},
			),
			Effect.forEach(
				deleted.flatMap((data) => data.indexedLinks),
				(link) => deletePointsByIdentifier(link),
				{
					concurrency: 5,
					discard: true,
				},
			),
		],
		{
			discard: true,
		},
	);

/** Deletes resources with their authorization state, tuples, files and search points. */
export const deleteResourcesWithAuthorization = (params: {
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	writeRelationships(
		{
			organizationIds: resourceOrganizations(
				params.resourceIds.map((resourceId) => ({
					resourceType: params.resourceType,
					resourceId,
				})),
			),
		},
		deleteResources(params),
	).pipe(
		Effect.flatMap(({ result }) =>
			removeDeletedResourceData([
				result,
			]),
		),
	);
