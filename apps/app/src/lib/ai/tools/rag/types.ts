import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";

type KnowledgeBaseBlockRef = {
	id: BlockId;
	name: DatabaseBlock["name"];
};

type KnowledgeBaseDocumentRef = {
	assetId: AssetId;
	title: string;
	citation?: string;
	totalPages?: number;
};

type KnowledgeBaseChunkRef = {
	index: number;
	count: number;
	pageStart?: number;
	pageEnd?: number;
};

type KnowledgeBaseCitationRef = {
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
