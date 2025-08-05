import type { Asset } from "@/lib/orpc/schemas/asset";
import type { FilePayload } from "./file";

export interface ProcessAssetTaskPayload {
	assetRef: Omit<FilePayload, "expiry">;
	mergePages: boolean;
}

export interface VectorizeAssetTaskPayload {
	prefix: string;
	assetId: Asset["id"];
	mergePages: boolean;
}
