import { backgroundWorkerDefinitions } from "@/definitions";
import { BackgroundWorkerLayer } from "@/layer";
import { runWorkerProcess } from "@/worker/run-worker-process";

void runWorkerProcess({
	name: "background workers",
	layer: BackgroundWorkerLayer,
	definitions: backgroundWorkerDefinitions,
});
