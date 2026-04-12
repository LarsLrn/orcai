import type { AssetPoint } from "@orcai/schema";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export type ResultSource = {
	blockId: DatabaseBlock["id"];
	blockName: DatabaseBlock["name"];
	assetId: Asset["id"];
	assetTitle: string;
	assetCitation?: string;
	documentTotalPages?: number;
	chunkPageStart?: number;
	chunkPageEnd?: number;
	chunkIndex: number;
	chunkCount: number;
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
	sourceBlockId: DatabaseBlock["id"];
	sourceBlockName: DatabaseBlock["name"];
};

export type KnowledgeBaseDocument = {
	assetId: string;
	title: string;
	citation?: string;
	blockId: DatabaseBlock["id"];
	blockName: DatabaseBlock["name"];
};
