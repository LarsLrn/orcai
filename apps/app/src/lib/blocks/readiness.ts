import type { AssetId, BlockId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { queueIndexing } from "@orcai/pg-boss";
import {
	type AssetReadiness,
	isRetryableFailure,
	type PipelineFailure,
	type PipelineStatus,
	type RepositoryReadiness,
	type RepositoryTotals,
} from "@orcai/schema";
import { and, asc, eq, getColumns, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { homeOrganization, inActivityRun } from "@/lib/activity/admission";
import { prepareAssetAgain } from "@/lib/assets/processing";
import { readableIds } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import * as AppErrors from "@/lib/effect/utils/errors";

type PipelineRow = {
	processingStatus: PipelineStatus;
	processingFailure: PipelineFailure | null;
	indexStatus: PipelineStatus;
	indexFailure: PipelineFailure | null;
};

/** The one place that combines an asset's processing with its indexing in a repository. */
export const assetState = (
	row: PipelineRow,
): Pick<AssetReadiness, "state" | "failure"> => {
	switch (row.processingStatus) {
		case "pending":
			return {
				state: "queued",
				failure: null,
			};
		case "active":
			return {
				state: "processing",
				failure: null,
			};
		case "failed":
			return {
				state: "failed",
				failure: {
					stage: "processing",
					kind: row.processingFailure ?? "other",
				},
			};
		case "completed":
			switch (row.indexStatus) {
				case "pending":
				case "active":
					return {
						state: "indexing",
						failure: null,
					};
				case "completed":
					return {
						state: "ready",
						failure: null,
					};
				case "failed":
					return {
						state: "failed",
						failure: {
							stage: "indexing",
							kind: row.indexFailure ?? "other",
						},
					};
			}
	}
};

/** `assetState`'s state in SQL, for totals counted in the database; the two must agree. */
const assetStateSql = sql<AssetReadiness["state"]>`case
	when ${dbSchema.asset.processingStatus} = 'pending' then 'queued'
	when ${dbSchema.asset.processingStatus} = 'active' then 'processing'
	when ${dbSchema.asset.processingStatus} = 'failed' then 'failed'
	when ${dbSchema.blockAsset.indexStatus} in ('pending', 'active') then 'indexing'
	when ${dbSchema.blockAsset.indexStatus} = 'completed' then 'ready'
	else 'failed'
end`;

const countWhere = (states: readonly AssetReadiness["state"][]) =>
	sql<number>`(count(*) filter (where ${assetStateSql} in ${states}))::int`;

/**
 * The asset totals of the repositories among `blockIds`, counted in one
 * query, as a lookup by block id. Callers check access.
 */
export const repositoryTotals = (blockIds: readonly BlockId[]) =>
	Effect.gen(function* () {
		const totalsById = new Map<BlockId, RepositoryTotals>();
		const lookup = (blockId: BlockId): RepositoryTotals =>
			totalsById.get(blockId) ?? {
				total: 0,
				ready: 0,
				preparing: 0,
				failed: 0,
			};
		if (blockIds.length === 0) return lookup;
		const rows = yield* (yield* DB)
			.select({
				blockId: dbSchema.blockAsset.blockId,
				total: sql<number>`count(*)::int`,
				ready: countWhere([
					"ready",
				]),
				preparing: countWhere([
					"queued",
					"processing",
					"indexing",
				]),
				failed: countWhere([
					"failed",
				]),
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(
				inArray(dbSchema.blockAsset.blockId, [
					...blockIds,
				]),
			)
			.groupBy(dbSchema.blockAsset.blockId);
		for (const { blockId, ...totals } of rows) {
			totalsById.set(blockId, totals);
		}
		return lookup;
	});

export const readinessTotals = (
	assets: readonly Pick<AssetReadiness, "state">[],
): RepositoryReadiness["totals"] => {
	const count = (states: readonly AssetReadiness["state"][]) =>
		assets.filter((asset) => states.includes(asset.state)).length;
	return {
		total: assets.length,
		ready: count([
			"ready",
		]),
		preparing: count([
			"queued",
			"processing",
			"indexing",
		]),
		failed: count([
			"failed",
		]),
	};
};

/**
 * The readiness of each repository the user can read among `blockIds`, in
 * their order. Unreadable, missing and non-repository ids are left out.
 */
export const loadRepositoryReadiness = (params: {
	blockIds: readonly BlockId[];
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const blockIds = Array.from(new Set(params.blockIds));
		if (blockIds.length === 0) return [];
		const db = yield* DB;

		const capabilities = yield* getManyEntityCapabilities({
			entityType: "block",
			entityIds: blockIds,
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});
		const readable = yield* readableIds("block", blockIds, {
			userId: params.userId,
			zedToken: params.zedToken,
		});
		const repositoryIds = blockIds.filter((blockId) => readable.has(blockId));
		if (repositoryIds.length === 0) return [];

		const [blocks, rows] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.block.id,
						name: dbSchema.block.name,
					})
					.from(dbSchema.block)
					.where(
						and(
							inArray(dbSchema.block.id, repositoryIds),
							eq(dbSchema.block.type, "database"),
						),
					),
				db
					.select({
						blockId: dbSchema.blockAsset.blockId,
						assetId: dbSchema.asset.id,
						title: dbSchema.asset.title,
						processingStatus: dbSchema.asset.processingStatus,
						processingFailure: dbSchema.asset.processingFailure,
						indexStatus: dbSchema.blockAsset.indexStatus,
						indexFailure: dbSchema.blockAsset.indexFailure,
					})
					.from(dbSchema.blockAsset)
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
					)
					.where(inArray(dbSchema.blockAsset.blockId, repositoryIds))
					.orderBy(asc(dbSchema.asset.title)),
			],
			{
				concurrency: "unbounded",
			},
		);

		const nameById = new Map(
			blocks.map((block) => [
				block.id,
				block.name,
			]),
		);

		return repositoryIds.flatMap((blockId): RepositoryReadiness[] => {
			const name = nameById.get(blockId);
			const blockCapabilities = capabilities.get(blockId);
			if (name === undefined || !blockCapabilities) return [];
			const assets = rows
				.filter((row) => row.blockId === blockId)
				.map(
					(row): AssetReadiness => ({
						assetId: row.assetId,
						title: row.title,
						...assetState(row),
					}),
				);
			return [
				{
					blockId,
					name,
					capabilities: blockCapabilities,
					totals: readinessTotals(assets),
					assets,
				},
			];
		});
	});

/** The repository's assets with what a retry needs, optionally only some. */
const loadAssets = (params: {
	blockId: BlockId;
	assetIds?: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				...getColumns(dbSchema.asset),
				indexStatus: dbSchema.blockAsset.indexStatus,
				indexFailure: dbSchema.blockAsset.indexFailure,
				indexAttempt: dbSchema.blockAsset.indexAttempt,
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(
				and(
					eq(dbSchema.blockAsset.blockId, params.blockId),
					params.assetIds
						? inArray(dbSchema.blockAsset.assetId, [
								...params.assetIds,
							])
						: undefined,
				),
			);
	});

type PreparableAsset = Effect.Success<ReturnType<typeof loadAssets>>[number];

/** Retries the assets' stages as one retry run of the user's in the repository. */
const runRetries = (params: {
	userId: UserId;
	blockId: BlockId;
	processing: readonly PreparableAsset[];
	indexing: readonly PreparableAsset[];
}) =>
	inActivityRun(
		{
			userId: params.userId,
			kind: "retry",
			organizationId: homeOrganization("block", params.blockId),
			blockId: params.blockId,
		},
		(runId) =>
			Effect.gen(function* () {
				// An asset another request already queued is not admitted again.
				const admitted = yield* Effect.forEach(params.processing, (asset) =>
					prepareAssetAgain(asset, {
						id: runId,
						blockId: params.blockId,
					}),
				);
				const indexing = yield* queueIndexing(
					params.indexing.map((asset) => ({
						assetId: asset.id,
						blockId: params.blockId,
						attempt: asset.indexAttempt,
					})),
					runId,
				);
				return {
					processing: admitted.filter(Boolean).length,
					indexing: indexing.length,
				};
			}),
	);

/**
 * Runs one asset's stage again: processing when the file failed,
 * otherwise indexing in this repository. An asset still being prepared has
 * nothing to retry.
 */
export const prepareRepositoryAssetAgain = (params: {
	userId: UserId;
	blockId: BlockId;
	assetId: AssetId;
}) =>
	Effect.gen(function* () {
		const [asset] = yield* loadAssets({
			blockId: params.blockId,
			assetIds: [
				params.assetId,
			],
		});
		if (!asset) {
			return yield* new AppErrors.NotFoundError({
				reason: "ASSET_NOT_ATTACHED",
				message: "Asset not attached to this repository",
			});
		}

		const { state, failure } = assetState(asset);
		const stage =
			state === "failed"
				? failure?.stage
				: state === "ready"
					? "indexing"
					: undefined;
		if (!stage) {
			return yield* new AppErrors.BadRequestError({
				reason: "ASSET_STILL_PREPARING",
				message: "The asset is still being prepared",
			});
		}

		const retried = yield* runRetries({
			userId: params.userId,
			blockId: params.blockId,
			processing:
				stage === "processing"
					? [
							asset,
						]
					: [],
			indexing:
				stage === "indexing"
					? [
							asset,
						]
					: [],
		});
		// Another request admitted the stage since the asset was read.
		if (retried[stage] === 0) {
			return yield* new AppErrors.BadRequestError({
				reason: "ASSET_STILL_PREPARING",
				message: "The asset is still being prepared",
			});
		}
		return {
			retried: stage,
		};
	});

/** Retries every failed asset of the repository that retrying can help. */
export const prepareRepositoryFailedAgain = (params: {
	userId: UserId;
	blockId: BlockId;
}) =>
	Effect.gen(function* () {
		const failed = (yield* loadAssets(params)).flatMap((asset) => {
			const { failure } = assetState(asset);
			return failure && isRetryableFailure(failure.kind)
				? [
						{
							asset,
							stage: failure.stage,
						},
					]
				: [];
		});

		return yield* runRetries({
			userId: params.userId,
			blockId: params.blockId,
			processing: failed
				.filter((entry) => entry.stage === "processing")
				.map((entry) => entry.asset),
			indexing: failed
				.filter((entry) => entry.stage === "indexing")
				.map((entry) => entry.asset),
		});
	});
