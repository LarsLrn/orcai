import { defineConfig, devices } from "@playwright/test";

const missing = [
	"BASE_URL",
	"PORT",
	"E2E_INFERENCE_PORT",
	"WEB_PORT",
].filter((name) => !process.env[name]);

if (missing.length > 0) {
	throw new Error(
		`Missing stack environment: ${missing.join(", ")}. Run the suite through \`bun run stack e2e\` or \`bun run stack exec\`.`,
	);
}

const baseURL = process.env.BASE_URL as string;
const inferenceURL = `http://127.0.0.1:${process.env.E2E_INFERENCE_PORT as string}/v1`;
const docsURL = `http://127.0.0.1:${process.env.WEB_PORT as string}`;
const isCI = Boolean(process.env.CI);
// `bun run stack e2e --pipeline`: the specs that need the background workers,
// which only this run starts. Elsewhere no queue exists, which other specs
// rely on.
const isPipeline = Boolean(process.env.E2E_PIPELINE);
const setupProject = {
	name: "setup",
	testMatch: /setup\/.*\.setup\.ts$/,
	use: {
		...devices["Desktop Chrome"],
	},
};

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: isCI,
	failOnFlakyTests: isCI,
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
	projects: isPipeline
		? [
				setupProject,
				{
					name: "pipeline",
					testMatch: /tests\/pipeline\/.*\.spec\.ts$/,
					dependencies: [
						"setup",
					],
					use: {
						...devices["Desktop Chrome"],
					},
				},
			]
		: [
				setupProject,
				{
					// Instance-wide state is shared, so these specs never run beside
					// anything else: the project is not parallel and `chromium` waits
					// for it.
					name: "instance",
					testMatch: /tests\/instance\/.*\.spec\.ts$/,
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
					testIgnore:
						/(setup\/.*\.setup\.ts|tests\/(instance|pipeline)\/.*\.spec\.ts)$/,
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
		...(isPipeline
			? [
					// Ready once every queue exists and every worker is registered.
					{
						command: "bun run workers:start",
						cwd: "../..",
						wait: {
							stdout: /background workers started/,
						},
						timeout: 60_000,
						stdout: "ignore" as const,
						stderr: "pipe" as const,
					},
				]
			: [
					// The docs site the assistant reads (`WEB_INTERNAL_URL`); it needs
					// no stack services. A running `bun run stack web` is reused.
					{
						command:
							"bun run build:web && bun apps/web/.output/server/index.mjs",
						cwd: "../..",
						env: {
							PORT: process.env.WEB_PORT as string,
						},
						url: `${docsURL}/llms.txt`,
						reuseExistingServer: true,
						timeout: 180_000,
						stdout: "ignore" as const,
						stderr: "pipe" as const,
					},
				]),
	],
});
