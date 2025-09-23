import "dotenv/config";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	project: process.env.TRIGGER_PROJECT || "default",
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
	build: {
		// This is required to use the Sharp library
		external: ["sharp"],
	},
	dirs: ["./src/trigger"],
});
