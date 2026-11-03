import { logErrorCause } from "@orcai/observability";
import { defineWorker, runWorkers } from "@orcai/pg-boss";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	dataExportPayloadSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import { failDataExports, runDataExport } from "./data-export";

/**
 * Works the data export queues in the app server, which holds the transcript
 * formatting, one export at a time. Shutting down interrupts a running
 * export; pg-boss retries it later.
 */
export const DataExportWorkerLive = Layer.effectDiscard(
	runWorkers([
		defineWorker({
			queue: DATA_EXPORT_JOB_NAME,
			payload: dataExportPayloadSchema,
			concurrency: 1,
			pollingIntervalSeconds: 2,
			handler: (job) =>
				runDataExport(job.data.dataExportId, transcriptMarkdown),
		}),
		defineWorker({
			queue: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
			payload: dataExportPayloadSchema,
			concurrency: 1,
			pollingIntervalSeconds: 2,
			handler: (job) =>
				failDataExports([
					job.data.dataExportId,
				]),
		}),
	]).pipe(
		Effect.catchCause((cause) =>
			logErrorCause("Data export worker failed to start", cause),
		),
		Effect.forkScoped,
	),
);
