import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type AssetReadiness,
	canPrepareAgain,
	type PipelineFailure,
	type PipelineStatus,
	type RepositoryReadiness,
	type RepositoryTotals,
} from "@orcai/schema";
import { eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

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

/** Why a person's request to prepare an asset again admits nothing. */
export type PrepareAgainRefusal = "preparing" | "unhelpful";

/**
 * The stage preparing the asset again runs, by the one rule every surface
 * and the server follow: processing when the file failed or its stored
 * extraction is missing, indexing in the repository when only that failed or
 * the asset is ready there. A file still being prepared, or one that would
 * fail the same way, has nothing to run. Without a link, the file.
 */
export const againStage = (
	asset: Pick<PipelineRow, "processingStatus" | "processingFailure"> & {
		readonly fileType: string;
	},
	link?: Pick<PipelineRow, "indexStatus" | "indexFailure">,
): "processing" | "indexing" | PrepareAgainRefusal => {
	const { state, failure } = assetState({
		...asset,
		...(link ?? {
			indexStatus: "completed",
			indexFailure: null,
		}),
	});
	if (failure) {
		if (!canPrepareAgain(failure.kind, asset.fileType)) return "unhelpful";
		return failure.kind === "missing_extraction" ? "processing" : failure.stage;
	}
	if (state !== "ready") return "preparing";
	return link ? "indexing" : "processing";
};
