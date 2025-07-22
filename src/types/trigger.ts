import type { Asset } from "@/db/schema/asset";
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
