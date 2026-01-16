import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	// biome-ignore lint/style/noNonNullAssertion: Env variable has to be defined.
	project: process.env.TRIGGER_PROJECT!,
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
