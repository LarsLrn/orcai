import * as Effect from "effect/Effect";
import { AiError } from "@/lib/effect/utils/errors";
import { client } from "@/lib/orpc/orpc";
import type { AssetPoint } from "@/lib/orpc/schemas/asset-point";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { normalizeText, tokenize } from "@/lib/utils/text-utils";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type {
	ChunkResult,
	KnowledgeBaseDocument,
	PointWithBlock,
	ResultSource,
	SearchResult,
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

export const toSearchKey = (point: PointWithBlock): string =>
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

export const withBlockSource = ({
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
	sourceBlockId: DatabaseBlock["id"];
	sourceBlockName: DatabaseBlock["name"];
	points: AssetPoint[];
}): PointWithBlock[] =>
	points.map((point) => ({
		...point,
		sourceBlockId,
		sourceBlockName,
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

const toSnippet = ({
	text,
	maxChars,
	queries,
}: {
	text: string;
	maxChars: number;
	queries: string[];
}) => {
	const normalized = normalizeText(text);
	if (normalized.length <= maxChars) return normalized;

	const queryTokens = queries
		.flatMap(tokenize)
		.filter((token) => token.length > 2)
		.sort((a, b) => b.length - a.length);
	const lowerText = normalized.toLowerCase();
	let matchIndex = -1;
	for (const token of queryTokens) {
		const index = lowerText.indexOf(token);
		if (index >= 0) {
			matchIndex = index;
			break;
		}
	}

	if (matchIndex >= 0) {
		// Center snippet around matched query term to avoid front-only bias.
		const halfWindow = Math.floor(maxChars / 2);
		let start = Math.max(0, matchIndex - halfWindow);
		const end = Math.min(normalized.length, start + maxChars);

		if (end - start < maxChars) {
			start = Math.max(0, end - maxChars);
		}

		const window = normalized.slice(start, end);
		const prefix = start > 0 ? "…" : "";
		const suffix = end < normalized.length ? "…" : "";
		return `${prefix}${window}${suffix}`;
	}

	// If there is no query-token hit, preserve both beginning and end.
	const bridge = " … ";
	const available = maxChars - bridge.length;
	const lead = Math.floor(available * 0.6);
	const tail = Math.max(0, available - lead);
	const headText = normalized.slice(0, lead).trimEnd();
	const tailText = normalized.slice(normalized.length - tail).trimStart();
	return `${headText}${bridge}${tailText}`;
};

const toSource = (point: PointWithBlock): ResultSource => ({
	blockId: point.sourceBlockId,
	blockName: point.sourceBlockName,
	assetId: point.payload.asset_id,
	page: point.payload.page,
	chunkIndex: point.payload.chunk_index,
	chunkCount: point.payload.chunkCount,
	createdAt: point.payload.createdAt,
});

export const toSearchResult = ({
	point,
	queries,
}: {
	point: PointWithBlock;
	queries: string[];
}): SearchResult => ({
	id: point.id,
	score: point.score,
	title: point.payload.title,
	snippet: toSnippet({
		text: point.payload.text,
		maxChars: RETRIEVAL_LIMITS.snippetLengthChars,
		queries,
	}),
	source: toSource(point),
});

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

export const loadDocumentCatalog = ({ blocks }: { blocks: DatabaseBlock[] }) =>
	Effect.gen(function* () {
		const blockAssetRefs = yield* Effect.forEach(
			blocks,
			(block) =>
				Effect.tryPromise({
					try: () =>
						client.block.find({
							id: block.id,
						}),
					catch: (cause) =>
						new AiError({
							operation: "loadDocumentCatalog.findBlock",
							cause,
						}),
				}).pipe(
					Effect.map((result) => ({
						block,
						assetIds: result.assets?.map((entry) => entry.asset.id) ?? [],
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

		const assetResponse = yield* Effect.tryPromise({
			try: () =>
				client.asset.list({
					pageIndex: 0,
					pageSize: Math.min(1000, Math.max(uniqueAssetIds.length, 20)),
					filters: {
						ids: uniqueAssetIds,
					},
				}),
			catch: (cause) =>
				new AiError({
					operation: "loadDocumentCatalog.listAssets",
					cause,
				}),
		});

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
					return {
						assetId,
						title: asset.title,
						blockId: block.id,
						blockName: block.name,
						mergePages: asset.metadata.mergePages ?? false,
					} satisfies KnowledgeBaseDocument;
				})
				.filter((entry) => entry !== null),
		);
	});

export const toChunkResult = (point: PointWithBlock): ChunkResult => ({
	id: point.id,
	score: point.score,
	title: point.payload.title,
	text: point.payload.text,
	source: toSource(point),
});

export const compareByPageAssetChunk = (
	a: PointWithBlock,
	b: PointWithBlock,
) => {
	const pageA =
		typeof a.payload.page === "number"
			? a.payload.page
			: Number.MAX_SAFE_INTEGER;
	const pageB =
		typeof b.payload.page === "number"
			? b.payload.page
			: Number.MAX_SAFE_INTEGER;
	if (pageA !== pageB) return pageA - pageB;
	if (a.payload.asset_id !== b.payload.asset_id) {
		return a.payload.asset_id.localeCompare(b.payload.asset_id);
	}
	return a.payload.chunk_index - b.payload.chunk_index;
};

export const selectByIds = ({
	candidates,
	ids,
}: {
	candidates: PointWithBlock[];
	ids: string[];
}) => {
	const idOrder = new Map(
		ids.map((id, index) => [
			id,
			index,
		]),
	);
	return candidates
		.filter((candidate) => idOrder.has(candidate.id))
		.sort(
			(a, b) =>
				(idOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
				(idOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
		);
};
