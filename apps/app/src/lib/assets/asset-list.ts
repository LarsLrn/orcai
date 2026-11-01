import type { ActivityRunId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ListAssetsInput, PipelineStatus } from "@orcai/schema";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	isNotNull,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { visibleRuns } from "@/lib/activity/runs";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { readableIds, requireReadable } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import type { LibraryAccess, Reader } from "@/lib/library/library-access";
import type { TileQuery } from "@/lib/library/tile-details";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";
import { literalSearch } from "@/lib/utils/literal-search";

const assetOrder = {
	newest: [
		desc(dbSchema.asset.createdAt),
		desc(dbSchema.asset.id),
	],
	name: [
		asc(dbSchema.asset.title),
		asc(dbSchema.asset.id),
	],
} satisfies Record<ListAssetsInput["sort"], unknown[]>;

const processingStatuses = {
	running: [
		"pending",
		"active",
	],
	failed: [
		"failed",
	],
} satisfies Record<
	NonNullable<NonNullable<ListAssetsInput["filters"]>["processing"]>,
	PipelineStatus[]
>;

/** The assets `query` selects, with what their tiles show. */
export const assetTiles = (reader: Reader, query: TileQuery) =>
	Effect.gen(function* () {
		const select = (yield* DB)
			.select({
				...getColumns(dbSchema.asset),
				owner: ownerColumns,
			})
			.from(dbSchema.asset)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.asset.userId))
			.where(query.where)
			.orderBy(...(query.orderBy ?? []))
			.$dynamic();
		const rows = yield* query.page
			? select.limit(query.page.limit).offset(query.page.offset)
			: select;

		const capabilities = yield* getManyEntityCapabilities({
			entityType: "asset",
			entityIds: rows.map((asset) => asset.id),
			userId: reader.userId,
			organizationId: reader.organizationId,
			zedToken: reader.zedToken,
		});

		return rows.map((asset) => ({
			...asset,
			capabilities: capabilities.get(asset.id) ?? emptyCapabilities("asset"),
		}));
	});

/** The assets of the user's run while it is visible to them; none otherwise. */
const runAssetIds = (runId: ActivityRunId, userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, activityRun } = dbSchema;
		const rows = yield* db
			.select({
				assetId: activityMember.assetId,
			})
			.from(activityMember)
			.innerJoin(activityRun, eq(activityRun.id, activityMember.runId))
			.where(
				and(
					eq(activityRun.id, runId),
					visibleRuns(userId),
					isNotNull(activityMember.assetId),
				),
			);
		return rows.flatMap((row) =>
			row.assetId
				? [
						row.assetId,
					]
				: [],
		);
	});

/** One page of a repository's assets, of known assets, of a run's assets, or of the active organisation's library. */
export const listAssetTiles = (params: {
	input: ListAssetsInput;
	reader: Reader;
	access: LibraryAccess;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { input, reader } = params;
		const { repositoryId, processing, suggestions, runId } =
			input.filters ?? {};
		const known = input.filters?.ids;
		const ids = runId
			? (yield* runAssetIds(runId, reader.userId)).filter(
					(id) => !known || known.includes(id),
				)
			: known;
		if (repositoryId) yield* requireReadable("block", repositoryId, reader);

		// A repository's assets, known ids and a run's assets are contents; the rest is the library.
		const where = and(
			repositoryId
				? inArray(
						dbSchema.asset.id,
						db
							.select({
								assetId: dbSchema.blockAsset.assetId,
							})
							.from(dbSchema.blockAsset)
							.where(eq(dbSchema.blockAsset.blockId, repositoryId)),
					)
				: ids
					? inArray(dbSchema.asset.id, [
							...(yield* readableIds("asset", ids, reader)),
						])
					: yield* params.access.condition("asset", {
							scope: suggestions ? "edit" : input.filters?.scope,
						}),
			repositoryId && ids ? inArray(dbSchema.asset.id, ids) : undefined,
			input.filters?.search
				? ilike(dbSchema.asset.title, literalSearch(input.filters.search))
				: undefined,
			input.filters?.keptIn
				? eq(dbSchema.asset.keptIn, input.filters.keptIn)
				: undefined,
			processing
				? inArray(
						dbSchema.asset.processingStatus,
						processingStatuses[processing],
					)
				: undefined,
			suggestions ? isNotNull(dbSchema.asset.metadataSuggestion) : undefined,
		);

		const [data, [counted]] = yield* Effect.all(
			[
				assetTiles(reader, {
					where,
					orderBy: assetOrder[input.sort],
					page: {
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					},
				}),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.asset)
					.where(where),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: counted.count,
		};
	});
