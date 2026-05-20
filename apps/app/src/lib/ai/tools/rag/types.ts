import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPoint } from "@orcai/schema";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export type KnowledgeBaseBlockRef = {
	id: BlockId;
	name: DatabaseBlock["name"];
};

export type KnowledgeBaseDocumentRef = {
	assetId: AssetId;
	title: string;
	citation?: string;
	totalPages?: number;
};

export type KnowledgeBaseChunkRef = {
	index: number;
	count: number;
	pageStart?: number;
	pageEnd?: number;
};

export type KnowledgeBaseCitationRef = {
	assetId: AssetId;
	title: string;
	page?: number;
	openTag: string;
	closeTag: "</cite>";
	example: string;
};

export type ResultSource = {
	block: KnowledgeBaseBlockRef;
	document: KnowledgeBaseDocumentRef;
	chunk: KnowledgeBaseChunkRef;
	citation: KnowledgeBaseCitationRef;
	createdAt: string;
};

type BaseResult = {
	id: string;
	score?: number;
	title: string;
	source: ResultSource;
};

export type SearchResult = BaseResult & {
	snippet: string;
};

export type ChunkResult = BaseResult & {
	text: string;
};

export type PointWithBlock = AssetPoint & {
	sourceBlock: KnowledgeBaseBlockRef;
};

export type KnowledgeBaseDocument = {
	assetId: string;
	title: string;
	citation?: string;
	documentTotalPages?: number;
	block: KnowledgeBaseBlockRef;
};
