import { ensureUploadLifecycle } from "@orcai/s3/server";
import { backgroundWorkers } from "@/definitions";
import { BackgroundWorkerLayer } from "@/layer";
import { runWorkerProcess } from "@/worker/run-worker-process";

runWorkerProcess({
	name: "background workers",
	layer: BackgroundWorkerLayer,
	workers: backgroundWorkers,
	setup: ensureUploadLifecycle,
});
