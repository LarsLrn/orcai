import { activityWorkers } from "@/activity/definitions";
import { assetWorkers } from "@/asset/definitions";
import { dataExportWorkers } from "@/data-export/definitions";
import { notificationWorkers } from "@/notification/definitions";
import { quotaWorkers } from "@/quota/definitions";

export const backgroundWorkers = [
	...quotaWorkers,
	...assetWorkers,
	...notificationWorkers,
	...dataExportWorkers,
	...activityWorkers,
];
