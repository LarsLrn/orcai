import {
	type AssetId,
	type BlockId,
	normalizeText,
	tokenize,
} from "@orcai/core";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { joinOverlapping } from "./passages";
import type {
	ChunkResult,
	KnowledgeBaseDocument,
	PointWithBlock,
} from "./types";

export const resolveSearchBlocks = ({
	blocks,
	blockId,
}: {
	blocks: DatabaseBlock[];
	blockId?: string;
}) => {
	if (!blockId) return blocks;
	return blocks.filter((block) => block.id === blockId);
};

const toSearchKey = (point: PointWithBlock): string =>
	`${point.payload.block_id}:${String(point.id)}`;

export const mergeAndSortCandidates = (points: PointWithBlock[]) =>
	Array.from(
		points
			.reduce((entries, point) => {
				const key = toSearchKey(point);
				const prev = entries.get(key);
				if (!prev || point.score > prev.score) {
					entries.set(key, point);
				}
				return entries;
			}, new Map<string, PointWithBlock>())
			.values(),
	).sort((a, b) => b.score - a.score);

const withBlockSource = ({
	block,
	points,
}: {
	block: DatabaseBlock;
	points: AssetPoint[];
}): PointWithBlock[] =>
	withSourceBlock({
		sourceBlockId: block.id,
		sourceBlockName: block.name,
		points,
	});

export const withSourceBlock = ({
	sourceBlockId,
	sourceBlockName,
	points,
}: {
	sourceBlockId: BlockId;
	sourceBlockName: DatabaseBlock["name"];
	points: AssetPoint[];
}): PointWithBlock[] =>
	points.map((point) => ({
		...point,
		sourceBlock: {
			id: sourceBlockId,
			name: sourceBlockName,
		},
	}));

export const flattenBlockResponses = (
	blockResponses: Array<{
		block: DatabaseBlock;
		response: {
			data: AssetPoint[];
		};
	}>,
): PointWithBlock[] =>
	blockResponses.flatMap(({ block, response }) =>
		withBlockSource({
			block,
			points: response.data,
		}),
	);

const escapeHtmlAttribute = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const buildCitationRef = ({
	assetId,
	title,
	pageStart,
	pageEnd,
}: {
	assetId: AssetId;
	title: string;
	pageStart?: number;
	pageEnd?: number;
}) => {
	const page = pageStart === pageEnd ? pageStart : undefined;
	const attributes = [
		`assetid="${escapeHtmlAttribute(assetId)}"`,
		`title="${escapeHtmlAttribute(title)}"`,
		...(typeof page === "number"
			? [
					`page="${String(page)}"`,
				]
			: []),
	].join(" ");
	const openTag = `<cite ${attributes}>`;

	return {
		assetId,
		title,
		page,
		openTag,
		closeTag: "</cite>" as const,
		example: `${openTag}quoted text${"</cite>"}`,
	};
};

const pagesOf = (run: PointWithBlock[]) => {
	const starts = run.flatMap((point) => point.payload.chunkPageStart ?? []);
	const ends = run.flatMap((point) => point.payload.chunkPageEnd ?? []);

	return {
		pageStart: starts.length > 0 ? Math.min(...starts) : undefined,
		pageEnd: ends.length > 0 ? Math.max(...ends) : undefined,
	};
};

/** A run of neighbouring chunks of one document as one result. */
export const toChunkResult = (run: PointWithBlock[]): ChunkResult => {
	const [first] = run;
	const { pageStart, pageEnd } = pagesOf(run);

	return {
		id: first.id,
		score: first.score,
		title: first.payload.title,
		text: run
			.map((point) => point.payload.text)
			.reduce((text, next) => joinOverlapping(text, next)),
		source: {
			block: first.sourceBlock,
			document: {
				assetId: first.payload.asset_id,
				title: first.payload.title,
				totalPages: first.payload.documentTotalPages,
			},
			chunk: {
				index: first.payload.chunk_index,
				count: first.payload.chunkCount,
				pageStart,
				pageEnd,
			},
			citation: buildCitationRef({
				assetId: first.payload.asset_id,
				title: first.payload.title,
				pageStart,
				pageEnd,
			}),
			createdAt: first.payload.createdAt,
		},
	};
};

export const rankDocumentsByQuery = ({
	documents,
	query,
}: {
	documents: KnowledgeBaseDocument[];
	query: string;
}) => {
	const normalizedQuery = normalizeText(query);
	const queryTokens = tokenize(normalizedQuery).filter(
		(token) => token.length > 1,
	);
	if (queryTokens.length === 0) return documents;

	return documents
		.map((doc) => {
			const normalizedTitle = normalizeText(doc.title);
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
				doc,
				score,
			};
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((item) => item.doc);
};

export const loadDocumentCatalog = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const blockAssetRefs = yield* Effect.forEach(
			blocks,
			(block) =>
				procedures.block
					.find(
						{
							id: block.id,
						},
						{
							context,
						},
					)
					.pipe(
						Effect.map((result) => ({
							block,
							assetIds:
								result.assets?.map((entry: { id: AssetId }) => entry.id) ?? [],
						})),
					),
			{
				concurrency: 4,
			},
		);

		const uniqueAssetIds = Array.from(
			new Set(blockAssetRefs.flatMap((item) => item.assetIds)),
		);
		if (uniqueAssetIds.length === 0) {
			return [];
		}

		const assetResponse = yield* procedures.asset.list(
			{
				pageIndex: 0,
				pageSize: Math.min(1000, Math.max(uniqueAssetIds.length, 20)),
				filters: {
					ids: uniqueAssetIds,
				},
			},
			{
				context,
			},
		);

		const assetById = new Map(
			assetResponse.data.map(
				(asset) =>
					[
						asset.id,
						asset,
					] as const,
			),
		);

		return blockAssetRefs.flatMap(({ block, assetIds }) =>
			assetIds
				.map((assetId) => {
					const asset = assetById.get(assetId);
					if (!asset) return null;
					const metadata = asset.metadata as {
						citation?: string;
					} | null;
					return {
						assetId,
						title: asset.title,
						citation: metadata?.citation ?? undefined,
						block: {
							id: block.id,
							name: block.name,
						},
					} satisfies KnowledgeBaseDocument;
				})
				.filter((entry) => entry !== null),
		);
	});

export const compareByPageAssetChunk = (
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
