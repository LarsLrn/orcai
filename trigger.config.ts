import { defineConfig } from "@trigger.dev/sdk";
import { serverEnv } from "@/lib/env/server";

export default defineConfig({
	project: serverEnv.TRIGGER_PROJECT,
	runtime: "node",
	logLevel: "log",
	maxDuration: 300,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./src/trigger"],
});
