import type { Asset } from "@/lib/orpc/schemas/asset";
import type { Block } from "@/lib/orpc/schemas/block";
import type { FilePayload } from "./file";

export interface ProcessAssetTaskPayload {
	assetRef: Omit<FilePayload, "expiry">;
	blockId: Block["id"];
	mergePages: boolean;
}

export interface VectorizeAssetTaskPayload {
	prefix: string;
	assetId: Asset["id"];
	blockId: Block["id"];
	mergePages: boolean;
}
