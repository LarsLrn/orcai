import type { Asset } from "@/lib/orpc/schemas/asset";
import type { AssetPoint } from "@/lib/orpc/schemas/asset-point";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export type ResultSource = {
	blockId: DatabaseBlock["id"];
	blockName: DatabaseBlock["name"];
	assetId: Asset["id"];
	page?: number;
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
	blockId: DatabaseBlock["id"];
	blockName: DatabaseBlock["name"];
};
