import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
	project: "proj_fzvmhxlzuofelfokxmnf",
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
