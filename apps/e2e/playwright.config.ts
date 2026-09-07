import { defineConfig, devices } from "@playwright/test";

const missing = [
	"BASE_URL",
	"PORT",
	"E2E_INFERENCE_PORT",
].filter((name) => !process.env[name]);

if (missing.length > 0) {
	throw new Error(
		`Missing stack environment: ${missing.join(", ")}. Run the suite through \`bun run stack e2e\` or \`bun run stack exec\`.`,
	);
}

const baseURL = process.env.BASE_URL as string;
const inferenceURL = `http://127.0.0.1:${process.env.E2E_INFERENCE_PORT as string}/v1`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	workers: isCI ? 2 : undefined,
	timeout: 30_000,
	reporter: isCI
		? [
				[
					"github",
				],
				[
					"html",
					{
						open: "never",
					},
				],
			]
		: [
				[
					"list",
				],
				[
					"html",
					{
						open: "never",
					},
				],
			],
	use: {
		baseURL,
		locale: "en",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /setup\/.*\.setup\.ts$/,
			use: {
				...devices["Desktop Chrome"],
			},
		},
		{
			// Instance-wide state is shared, so these specs never run beside
			// anything else: the project is not parallel and `chromium` waits
			// for it.
			name: "instance",
			testMatch: /instance\/.*\.spec\.ts$/,
			fullyParallel: false,
			workers: 1,
			dependencies: [
				"setup",
			],
			use: {
				...devices["Desktop Chrome"],
			},
		},
		{
			name: "chromium",
			testIgnore: /(setup\/.*\.setup\.ts|instance\/.*\.spec\.ts)$/,
			dependencies: [
				"instance",
			],
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	// Started in order. The mock inference server comes first because the app
	// reads its global endpoint (`OPENAI_COMPATIBLE_BASE_URL`, set by
	// `bun run stack e2e` to this URL) once at start.
	webServer: [
		{
			command: "bun fixtures/inference/serve.ts",
			url: `${inferenceURL}/models`,
			reuseExistingServer: false,
			timeout: 30_000,
			stdout: "ignore",
			stderr: "pipe",
		},
		{
			command: "bun run build:app && bun run start",
			cwd: "../..",
			url: baseURL,
			reuseExistingServer: true,
			timeout: 180_000,
			stdout: "ignore",
			stderr: "pipe",
		},
	],
});
