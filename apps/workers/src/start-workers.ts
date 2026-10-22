import { ensureUploadLifecycle } from "@orcai/s3/server";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
} from "@orcai/schema";
import { backgroundWorkerDefinitions } from "@/definitions";
import { BackgroundWorkerLayer } from "@/layer";
import { runWorkerProcess } from "@/worker/run-worker-process";

void runWorkerProcess({
	name: "background workers",
	layer: BackgroundWorkerLayer,
	definitions: backgroundWorkerDefinitions,
	// The app server works data exports: they need its transcript formatting.
	queues: [
		{
			name: DATA_EXPORT_JOB_NAME,
			deadLetter: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
		},
		{
			name: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
		},
	],
	setup: ensureUploadLifecycle,
});
