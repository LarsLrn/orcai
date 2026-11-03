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

const dataExportIdOf = (data: unknown) =>
	Effect.try(() => dataExportPayloadSchema.parse(data).dataExportId);

/**
 * Works the data export queues in the app server, which holds the transcript
 * formatting, one export at a time. Shutting down interrupts a running
 * export; pg-boss retries it later.
 */
export const DataExportWorkerLive = Layer.effectDiscard(
	runWorkers([
		defineWorker({
			queue: DATA_EXPORT_JOB_NAME,
			concurrency: 1,
			pollingIntervalSeconds: 2,
			handler: (job) =>
				dataExportIdOf(job.data).pipe(
					Effect.flatMap((id) => runDataExport(id, transcriptMarkdown)),
				),
		}),
		defineWorker({
			queue: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
			concurrency: 1,
			pollingIntervalSeconds: 2,
			handler: (job) =>
				dataExportIdOf(job.data).pipe(
					Effect.flatMap((id) =>
						failDataExports([
							id,
						]),
					),
				),
		}),
	]).pipe(
		Effect.catchCause((cause) =>
			logErrorCause("Data export worker failed to start", cause),
		),
		Effect.forkScoped,
	),
);
