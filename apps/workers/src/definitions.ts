import type { ActivityWorkerContext } from "@/activity/definitions";
import { activityWorkerDefinitions } from "@/activity/definitions";
import type { AssetWorkerContext } from "@/asset/definitions";
import { assetWorkerDefinitions } from "@/asset/definitions";
import type { DataExportWorkerContext } from "@/data-export/definitions";
import { dataExportWorkerDefinitions } from "@/data-export/definitions";
import type { NotificationWorkerContext } from "@/notification/definitions";
import { notificationWorkerDefinitions } from "@/notification/definitions";
import type { QuotaWorkerContext } from "@/quota/definitions";
import { quotaWorkerDefinitions } from "@/quota/definitions";
import type { WorkerDefinition } from "@/worker/types";

export type BackgroundWorkerContext =
	| ActivityWorkerContext
	| AssetWorkerContext
	| QuotaWorkerContext
	| NotificationWorkerContext
	| DataExportWorkerContext;

export const backgroundWorkerDefinitions = [
	...quotaWorkerDefinitions,
	...assetWorkerDefinitions,
	...notificationWorkerDefinitions,
	...dataExportWorkerDefinitions,
	...activityWorkerDefinitions,
] as readonly WorkerDefinition<BackgroundWorkerContext, unknown>[];
