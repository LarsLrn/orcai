import type { AssetWorkerContext } from "@/asset/definitions";
import { assetWorkerDefinitions } from "@/asset/definitions";
import type { QuotaWorkerContext } from "@/quota/definitions";
import { quotaWorkerDefinitions } from "@/quota/definitions";
import type { WorkerDefinition } from "@/worker/types";

export type BackgroundWorkerContext = AssetWorkerContext | QuotaWorkerContext;

export const backgroundWorkerDefinitions = [
	...quotaWorkerDefinitions,
	...assetWorkerDefinitions,
] as readonly WorkerDefinition<BackgroundWorkerContext, unknown>[];
