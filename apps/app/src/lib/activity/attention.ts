import type { AssetId, BlockId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ActivityFailure } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { and, desc, eq, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { Viewer } from "@/lib/activity/runs";
import { readableIds } from "@/lib/authz/content-access";
import * as AppErrors from "@/lib/effect/utils/errors";

const {
	activityDismissal,
	asset,
	block,
	blockAsset,
	dataExport,
	member,
	organization,
	resourceScope,
} = dbSchema;

const notDismissed = (userId: UserId, occurrenceId: unknown) =>
	sql`not exists (select 1 from ${activityDismissal} where ${activityDismissal.userId} = ${userId} and ${activityDismissal.occurrenceId} = ${occurrenceId})`;

/** The home organisation of a resource the user still belongs to. */
const memberHome = (
	userId: UserId,
	resourceType: "asset" | "block",
	resourceId: typeof asset.id | typeof block.id,
) =>
	and(
		eq(resourceScope.resourceType, resourceType),
		eq(resourceScope.resourceId, resourceId),
		eq(resourceScope.isPrimary, true),
		sql`${resourceScope.endedAt} is null`,
		sql`exists (select 1 from ${member} where ${member.organizationId} = ${resourceScope.organizationId} and ${member.userId} = ${userId})`,
	);

/**
 * The library assets whose processing or metadata failure, or pending
 * suggestion, is the user's: they asked for that work, or uploaded the asset
 * and nobody asked. Only in organisations they belong to.
 */
const assetCandidates = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const processingFailed = and(
			sql`${asset.processingStatus} = 'failed'`,
			sql`coalesce(${asset.processingActorId}, ${asset.userId}) = ${userId}`,
			notDismissed(userId, asset.processingFailureId),
		);
		const metadataOwned = sql`coalesce(${asset.metadataActorId}, ${asset.userId}) = ${userId}`;
		const metadataFailed = and(
			sql`${asset.metadataStatus} = 'failed'`,
			metadataOwned,
			notDismissed(userId, asset.metadataFailureId),
		);
		const suggested = and(
			sql`${asset.metadataSuggestion} is not null`,
			metadataOwned,
		);
		return yield* db
			.select({
				id: asset.id,
				title: asset.title,
				processingFailed: sql<boolean>`${processingFailed}`,
				processingFailure: asset.processingFailure,
				processingFailureId: asset.processingFailureId,
				metadataFailed: sql<boolean>`${metadataFailed}`,
				metadataFailure: asset.metadataFailure,
				metadataFailureId: asset.metadataFailureId,
				suggested: sql<boolean>`${suggested}`,
				organizationId: organization.id,
				organizationName: organization.name,
			})
			.from(asset)
			.innerJoin(resourceScope, memberHome(userId, "asset", asset.id))
			.innerJoin(
				organization,
				eq(organization.id, resourceScope.organizationId),
			)
			.where(
				and(
					eq(asset.keptIn, "library"),
					or(processingFailed, metadataFailed, suggested),
				),
			);
	});

/**
 * The failed repository links that are the user's: they asked for the
 * indexing, or uploaded the asset and nobody asked. Only in repositories of
 * organisations they belong to.
 */
const linkCandidates = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				assetId: asset.id,
				title: asset.title,
				blockId: block.id,
				blockName: block.name,
				failure: blockAsset.indexFailure,
				failureId: blockAsset.indexFailureId,
				organizationId: organization.id,
				organizationName: organization.name,
			})
			.from(blockAsset)
			.innerJoin(asset, eq(asset.id, blockAsset.assetId))
			.innerJoin(block, eq(block.id, blockAsset.blockId))
			.innerJoin(resourceScope, memberHome(userId, "block", block.id))
			.innerJoin(
				organization,
				eq(organization.id, resourceScope.organizationId),
			)
			.where(
				and(
					sql`${blockAsset.indexStatus} = 'failed'`,
					or(
						eq(blockAsset.indexActorId, userId),
						and(
							sql`${blockAsset.indexActorId} is null`,
							eq(asset.userId, userId),
						),
					),
					notDismissed(userId, blockAsset.indexFailureId),
				),
			);
	});

/** The user's failed exports no later export replaced. */
const exportCandidates = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				id: dataExport.id,
			})
			.from(dataExport)
			.where(
				and(
					eq(dataExport.userId, userId),
					eq(dataExport.status, "failed"),
					sql`not exists (select 1 from ${dataExport} later where later.user_id = ${dataExport.userId} and later.created_at > ${dataExport.createdAt} and later.status = 'ready')`,
					notDismissed(userId, dataExport.id),
				),
			)
			.orderBy(desc(dataExport.createdAt));
	});

/**
 * What needs the user now: failures of work they asked for or of their own
 * uploads, and pending suggestions they can review, among the assets and
 * repositories they may read. Dismissed failures stay hidden.
 */
export const attention = (viewer: Viewer) =>
	Effect.gen(function* () {
		const [assets, links, exports] = yield* Effect.all(
			[
				assetCandidates(viewer.userId),
				linkCandidates(viewer.userId),
				exportCandidates(viewer.userId),
			],
			{
				concurrency: "unbounded",
			},
		);
		const assetIds = [
			...new Set<AssetId>([
				...assets.map((row) => row.id),
				...links.map((row) => row.assetId),
			]),
		];
		const blockIds = [
			...new Set<BlockId>(links.map((row) => row.blockId)),
		];
		const suggestedIds = assets
			.filter((row) => row.suggested)
			.map((row) => row.id);
		const [readableAssets, readableBlocks, editable] = yield* Effect.all(
			[
				assetIds.length > 0
					? readableIds("asset", assetIds, viewer)
					: Effect.succeed(new Set<AssetId>()),
				blockIds.length > 0
					? readableIds("block", blockIds, viewer)
					: Effect.succeed(new Set<BlockId>()),
				suggestedIds.length > 0
					? permittedEntityIds({
							entityType: "asset",
							entityIds: suggestedIds,
							permission: "edit",
							userId: viewer.userId,
							zedToken: viewer.zedToken,
						})
					: Effect.succeed(new Set<AssetId>()),
			],
			{
				concurrency: "unbounded",
			},
		);

		const readable = assets.filter((row) => readableAssets.has(row.id));
		const failures: ActivityFailure[] = [
			...readable.flatMap((row) => {
				const organization = {
					id: row.organizationId,
					name: row.organizationName,
				};
				const named = {
					id: row.id,
					title: row.title,
				};
				return [
					...(row.processingFailed && row.processingFailureId
						? [
								{
									occurrenceId: row.processingFailureId,
									stage: "processing" as const,
									failure: row.processingFailure,
									asset: named,
									repository: null,
									dataExportId: null,
									organization,
								},
							]
						: []),
					...(row.metadataFailed && row.metadataFailureId
						? [
								{
									occurrenceId: row.metadataFailureId,
									stage: "metadata" as const,
									failure: row.metadataFailure,
									asset: named,
									repository: null,
									dataExportId: null,
									organization,
								},
							]
						: []),
				];
			}),
			...links.flatMap((row) =>
				row.failureId &&
				readableAssets.has(row.assetId) &&
				readableBlocks.has(row.blockId)
					? [
							{
								occurrenceId: row.failureId,
								stage: "indexing" as const,
								failure: row.failure,
								asset: {
									id: row.assetId,
									title: row.title,
								},
								repository: {
									id: row.blockId,
									name: row.blockName,
								},
								dataExportId: null,
								organization: {
									id: row.organizationId,
									name: row.organizationName,
								},
							},
						]
					: [],
			),
			...exports.map((row) => ({
				occurrenceId: row.id,
				stage: "export" as const,
				failure: null,
				asset: null,
				repository: null,
				dataExportId: row.id,
				organization: null,
			})),
		];

		const suggestions = new Map<
			OrganizationId,
			{
				organization: {
					id: OrganizationId;
					name: string;
				};
				count: number;
			}
		>();
		for (const row of readable) {
			if (!editable.has(row.id)) continue;
			const entry = suggestions.get(row.organizationId) ?? {
				organization: {
					id: row.organizationId,
					name: row.organizationName,
				},
				count: 0,
			};
			entry.count += 1;
			suggestions.set(row.organizationId, entry);
		}

		return {
			suggestions: [
				...suggestions.values(),
			],
			failures,
		};
	});

/**
 * Hides one of the user's failures for them; the target's next failure shows
 * again. Only a failure the user currently sees can be dismissed.
 */
export const dismissFailure = (viewer: Viewer, occurrenceId: string) =>
	Effect.gen(function* () {
		const { failures } = yield* attention(viewer);
		if (!failures.some((failure) => failure.occurrenceId === occurrenceId)) {
			return yield* new AppErrors.NotFoundError({
				reason: "ACTIVITY_FAILURE_NOT_FOUND",
				message: "No such failure to dismiss",
			});
		}
		const db = yield* DB;
		yield* db
			.insert(activityDismissal)
			.values({
				userId: viewer.userId,
				occurrenceId,
			})
			.onConflictDoNothing();
	});
