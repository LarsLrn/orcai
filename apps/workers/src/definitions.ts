import type { AssetWorkerContext } from "@/asset/definitions";
import { assetWorkerDefinitions } from "@/asset/definitions";
import type { NotificationWorkerContext } from "@/notification/definitions";
import { notificationWorkerDefinitions } from "@/notification/definitions";
import type { QuotaWorkerContext } from "@/quota/definitions";
import { quotaWorkerDefinitions } from "@/quota/definitions";
import type { WorkerDefinition } from "@/worker/types";

export type BackgroundWorkerContext =
	| AssetWorkerContext
	| QuotaWorkerContext
	| NotificationWorkerContext;

export const backgroundWorkerDefinitions = [
	...quotaWorkerDefinitions,
	...assetWorkerDefinitions,
	...notificationWorkerDefinitions,
] as readonly WorkerDefinition<BackgroundWorkerContext, unknown>[];
