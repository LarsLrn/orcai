import {
	type AssetId,
	type BlockId,
	normalizeText,
	tokenize,
} from "@orcai/core";
import {
	type AssetReadiness,
	type AssetState,
	BLOCK_READINESS_MAX_IDS,
	type Repository,
	type RepositoryReadiness,
	type RetrievedAssetPoint,
} from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { sourceRef } from "@/lib/ai/citations/source-ref";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { joinOverlapping } from "./passages";
import type { Passage, PointWithBlock, RepositoryAsset } from "./types";

export const resolveSearchBlocks = ({
	blocks,
	blockId,
}: {
	blocks: Repository[];
	blockId?: string;
}) => {
	if (!blockId) return blocks;
	return blocks.filter((block) => block.id === blockId);
};

const withBlockSource = ({
	block,
	points,
}: {
	block: Repository;
	points: RetrievedAssetPoint[];
}): PointWithBlock[] =>
	withRepository({
		repositoryId: block.id,
		repositoryName: block.name,
		points,
	});

export const withRepository = ({
	repositoryId,
	repositoryName,
	points,
}: {
	repositoryId: BlockId;
	repositoryName: Repository["name"];
	points: RetrievedAssetPoint[];
}): PointWithBlock[] =>
	points.map((point) => ({
		...point,
		repository: {
			id: repositoryId,
			name: repositoryName,
		},
	}));

type BlockResponse = {
	block: Repository;
	response: {
		data: RetrievedAssetPoint[];
	};
};

export const flattenBlockResponses = (
	blockResponses: readonly BlockResponse[],
): PointWithBlock[] =>
	blockResponses.flatMap(({ block, response }) =>
		withBlockSource({
			block,
			points: response.data,
		}),
	);

/**
 * The repositories' results as one list: each repository's best passage,
 * then each one's second best, and so on. Every repository is ranked by a
 * search of its own, so their scores do not compare.
 */
export const mergeByRank = (
	blockResponses: readonly BlockResponse[],
): PointWithBlock[] => {
	const lists = blockResponses.map(({ block, response }) =>
		withBlockSource({
			block,
			points: response.data,
		}),
	);
	return Array.from(
		{
			length: Math.max(0, ...lists.map((list) => list.length)),
		},
		(_, rank) =>
			lists.flatMap((list) =>
				rank < list.length
					? [
							list[rank],
						]
					: [],
			),
	).flat();
};

/** A run of neighbouring points of one asset as one passage, named for `anchor`. */
export const toPassage = (
	run: PointWithBlock[],
	anchor: PointWithBlock = run[0],
): Passage => {
	const [first] = run;
	const starts = run.flatMap((point) => point.payload.chunkPageStart ?? []);
	const ends = run.flatMap((point) => point.payload.chunkPageEnd ?? []);

	return {
		ref: sourceRef("passage", anchor.id),
		id: anchor.id,
		assetId: first.payload.asset_id,
		title: first.title,
		blockName: first.repository.name,
		pageStart: starts.length > 0 ? Math.min(...starts) : undefined,
		pageEnd: ends.length > 0 ? Math.max(...ends) : undefined,
		totalPages: first.payload.documentTotalPages,
		text: run
			.map((point) => point.payload.text)
			.reduce((text, next) => joinOverlapping(text, next)),
	};
};

export const rankAssetsByQuery = ({
	assets,
	query,
}: {
	assets: RepositoryAsset[];
	query: string;
}) => {
	const normalizedQuery = normalizeText(query);
	const queryTokens = tokenize(normalizedQuery).filter(
		(token) => token.length > 1,
	);
	if (queryTokens.length === 0) return assets;

	return assets
		.map((asset) => {
			const normalizedTitle = normalizeText(asset.title);
			const exactTokenMatches = queryTokens.filter((token) =>
				normalizedTitle.includes(token),
			).length;
			const phraseBonus = normalizedTitle.includes(normalizedQuery) ? 2 : 0;
			const startsWithBonus = queryTokens.some((token) =>
				normalizedTitle.startsWith(token),
			)
				? 0.5
				: 0;
			const score = exactTokenMatches + phraseBonus + startsWithBonus;
			return {
				asset,
				score,
			};
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((item) => item.asset);
};

/** The most assets one `asset.list` page holds. */
const ASSET_PAGE_SIZE = 1000;

/** Ready first: an asset ready in one searched repository is searchable. */
const STATE_ORDER: readonly AssetState[] = [
	"ready",
	"indexing",
	"processing",
	"queued",
	"failed",
];

const furthestAsset = (a: AssetReadiness, b: AssetReadiness): AssetReadiness =>
	STATE_ORDER.indexOf(b.state) < STATE_ORDER.indexOf(a.state) ? b : a;

/** The assets of `blocks`, once each, with their readiness, citation and description. */
export const loadAssetCatalog = ({
	blocks,
	context,
}: {
	blocks: Repository[];
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const repositories = yield* loadReadiness({
			blocks,
			context,
		});

		const assetById = new Map<string, AssetReadiness>();
		for (const asset of repositories.flatMap(
			(repository) => repository.assets,
		)) {
			const known = assetById.get(asset.assetId);
			assetById.set(asset.assetId, known ? furthestAsset(known, asset) : asset);
		}
		if (assetById.size === 0) {
			return [];
		}

		const assetPages = yield* Effect.forEach(
			Arr.chunksOf(
				[
					...assetById.keys(),
				] as AssetId[],
				ASSET_PAGE_SIZE,
			),
			(ids) =>
				procedures.asset.list(
					{
						pageIndex: 0,
						pageSize: ASSET_PAGE_SIZE,
						filters: {
							ids,
						},
					},
					{
						context,
					},
				),
			{
				concurrency: 4,
			},
		);
		const metadataById = new Map(
			assetPages
				.flatMap(({ data }) => data)
				.map(
					(asset) =>
						[
							asset.id,
							asset.metadata as {
								citationLabel?: string;
								description?: string;
							} | null,
						] as const,
				),
		);

		return [
			...assetById.values(),
		].map(
			(asset): RepositoryAsset => ({
				assetId: asset.assetId,
				title: asset.title,
				citationLabel:
					metadataById.get(asset.assetId)?.citationLabel ?? undefined,
				description: metadataById.get(asset.assetId)?.description ?? undefined,
				state: asset.state,
				failure: asset.failure ?? undefined,
			}),
		);
	});

export const loadReadiness = ({
	blocks,
	context,
}: {
	blocks: Repository[];
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const batches = yield* Effect.forEach(
			Arr.chunksOf(
				blocks.map((block) => block.id),
				BLOCK_READINESS_MAX_IDS,
			),
			(blockIds) =>
				procedures.block.readiness(
					{
						blockIds,
					},
					{
						context,
					},
				),
			{
				concurrency: 4,
			},
		);
		return batches.flatMap(({ data }) => data);
	});

/**
 * Tells the model which searched repositories hold assets search cannot
 * see yet, so it does not present them as empty.
 */
export const unsearchableAssets = (
	repositories: readonly Pick<RepositoryReadiness, "name" | "totals">[],
) =>
	repositories
		.filter(({ totals }) => totals.preparing > 0 || totals.failed > 0)
		.map(({ name, totals }) => ({
			repository: name,
			ready: totals.ready,
			total: totals.total,
			preparing: totals.preparing,
			failed: totals.failed,
			note: [
				`${totals.ready} of ${totals.total} assets in ${JSON.stringify(name)} are searchable.`,
				totals.preparing > 0
					? `${totals.preparing} ${totals.preparing === 1 ? "is" : "are"} still being prepared.`
					: undefined,
				totals.failed > 0
					? `${totals.failed} could not be prepared.`
					: undefined,
			]
				.filter(Boolean)
				.join(" "),
		}));

export const compareByPageAssetPassage = (
	a: PointWithBlock,
	b: PointWithBlock,
) => {
	const pageA =
		typeof a.payload.chunkPageStart === "number"
			? a.payload.chunkPageStart
			: Number.MAX_SAFE_INTEGER;
	const pageB =
		typeof b.payload.chunkPageStart === "number"
			? b.payload.chunkPageStart
			: Number.MAX_SAFE_INTEGER;
	if (pageA !== pageB) return pageA - pageB;
	if (a.payload.asset_id !== b.payload.asset_id) {
		return a.payload.asset_id.localeCompare(b.payload.asset_id);
	}
	return a.payload.chunk_index - b.payload.chunk_index;
};
