import {
	type AssetId,
	type BlockId,
	normalizeText,
	tokenize,
} from "@orcai/core";
import {
	BLOCK_READINESS_MAX_IDS,
	type DatabaseBlock,
	type DocumentReadiness,
	type DocumentState,
	type RepositoryReadiness,
	type RetrievedAssetPoint,
} from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { chunkRef } from "./chunk-ref";
import { joinOverlapping } from "./passages";
import type { KnowledgeBaseDocument, Passage, PointWithBlock } from "./types";

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
	points: RetrievedAssetPoint[];
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
	points: RetrievedAssetPoint[];
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
			data: RetrievedAssetPoint[];
		};
	}>,
): PointWithBlock[] =>
	blockResponses.flatMap(({ block, response }) =>
		withBlockSource({
			block,
			points: response.data,
		}),
	);

/** A run of neighbouring chunks of one document as one passage, named for `anchor`. */
export const toPassage = (
	run: PointWithBlock[],
	anchor: PointWithBlock = run[0],
): Passage => {
	const [first] = run;
	const starts = run.flatMap((point) => point.payload.chunkPageStart ?? []);
	const ends = run.flatMap((point) => point.payload.chunkPageEnd ?? []);

	return {
		ref: chunkRef(anchor.id),
		id: anchor.id,
		assetId: first.payload.asset_id,
		title: first.title,
		blockName: first.sourceBlock.name,
		pageStart: starts.length > 0 ? Math.min(...starts) : undefined,
		pageEnd: ends.length > 0 ? Math.max(...ends) : undefined,
		totalPages: first.payload.documentTotalPages,
		text: run
			.map((point) => point.payload.text)
			.reduce((text, next) => joinOverlapping(text, next)),
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

/** The most assets one `asset.list` page holds. */
const ASSET_PAGE_SIZE = 1000;

/** Ready first: a document ready in one searched repository is searchable. */
const STATE_ORDER: readonly DocumentState[] = [
	"ready",
	"indexing",
	"processing",
	"queued",
	"failed",
];

const furthestDocument = (
	a: DocumentReadiness,
	b: DocumentReadiness,
): DocumentReadiness =>
	STATE_ORDER.indexOf(b.state) < STATE_ORDER.indexOf(a.state) ? b : a;

/** The documents of `blocks`, once each, with their readiness and citation. */
export const loadDocumentCatalog = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const repositories = yield* loadReadiness({
			blocks,
			context,
		});

		const documentById = new Map<string, DocumentReadiness>();
		for (const document of repositories.flatMap(
			(repository) => repository.documents,
		)) {
			const known = documentById.get(document.assetId);
			documentById.set(
				document.assetId,
				known ? furthestDocument(known, document) : document,
			);
		}
		if (documentById.size === 0) {
			return [];
		}

		const assetPages = yield* Effect.forEach(
			Arr.chunksOf(
				[
					...documentById.keys(),
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
		const citationById = new Map(
			assetPages
				.flatMap(({ data }) => data)
				.map(
					(asset) =>
						[
							asset.id,
							(
								asset.metadata as {
									citation?: string;
								} | null
							)?.citation,
						] as const,
				),
		);

		return [
			...documentById.values(),
		].map(
			(document): KnowledgeBaseDocument => ({
				assetId: document.assetId,
				title: document.title,
				citation: citationById.get(document.assetId) ?? undefined,
				state: document.state,
				failure: document.failure ?? undefined,
			}),
		);
	});

export const loadReadiness = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
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
 * Tells the model which searched repositories hold documents search cannot
 * see yet, so it does not present them as empty.
 */
export const unsearchableDocuments = (
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
				`${totals.ready} of ${totals.total} documents in ${name} are searchable.`,
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
