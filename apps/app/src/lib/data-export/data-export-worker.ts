import { logErrorCause } from "@orcai/observability";
import { defineWorker, runWorkers } from "@orcai/pg-boss";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	DATA_EXPORT_SWEEP_JOB_NAME,
	dataExportPayloadSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import {
	failDataExports,
	runDataExport,
	sweepDataExports,
} from "./data-export";

/** Works the queues in the background and logs a start that fails. */
const inBackground = <E, R>(name: string, workers: Effect.Effect<void, E, R>) =>
	workers.pipe(
		Effect.catchCause((cause) =>
			logErrorCause(`${name} failed to start`, cause),
		),
		Effect.forkScoped,
	);

/**
 * Works the data export queues in the app server, which holds the transcript
 * formatting, one export at a time. Shutting down interrupts a running
 * export; pg-boss retries it later. The sweep starts on its own, so it still
 * fails exports no job will finish when the export workers cannot start.
 */
export const DataExportWorkerLive = Layer.effectDiscard(
	Effect.all([
		inBackground(
			"Data export worker",
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
						]).pipe(Effect.asVoid),
				}),
			]),
		),
		inBackground(
			"Data export sweep",
			runWorkers([
				defineWorker({
					queue: DATA_EXPORT_SWEEP_JOB_NAME,
					concurrency: 1,
					pollingIntervalSeconds: 30,
					handler: () => sweepDataExports,
				}),
			]),
		),
	]),
);
