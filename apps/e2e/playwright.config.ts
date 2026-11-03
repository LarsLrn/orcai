import { defineConfig, devices } from "@playwright/test";

const missing = [
	"BETTER_AUTH_URL",
	"PORT",
	"E2E_INFERENCE_PORT",
	"WEB_PORT",
	"E2E_CONTAINER_ENV_FILE",
	"E2E_APP_IMAGE",
	"E2E_WEB_IMAGE",
	"E2E_WORKERS_IMAGE",
].filter((name) => !process.env[name]);

if (missing.length > 0) {
	throw new Error(
		`Missing stack environment: ${missing.join(", ")}. Run the suite through \`bun run stack e2e\` or \`bun run stack exec\`.`,
	);
}

const baseURL = process.env.BETTER_AUTH_URL as string;
const inferenceURL = `http://127.0.0.1:${process.env.E2E_INFERENCE_PORT as string}/v1`;
const docsURL = `http://127.0.0.1:${process.env.WEB_PORT as string}`;
const isCI = Boolean(process.env.CI);
// `bun run stack e2e --pipeline`: the specs that need the background workers,
// which only this run starts. Elsewhere no queue exists, which other specs
// rely on.
const isPipeline = Boolean(process.env.E2E_PIPELINE);
// CI runs the instance specs in a job of their own, and its shards set
// `E2E_NO_INSTANCE`: Playwright would run a dependency project on every shard.
const withInstance = !process.env.E2E_NO_INSTANCE;
// The production images on the host network, so they reach the stack and the
// mock inference server on loopback. Each container is named after its image.
const container = (image: string, args: string[] = []) =>
	[
		"docker run --rm --init --network host",
		`--env-file ${process.env.E2E_CONTAINER_ENV_FILE as string}`,
		...args,
		`--name ${image} ${image}`,
	].join(" ");
// Stops the container through `docker run`, which forwards the signal.
const gracefulShutdown = {
	signal: "SIGTERM" as const,
	timeout: 10_000,
};
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
	reporter: [
		[
			isCI ? "github" : "list",
		],
		[
			"html",
			{
				open: "never",
			},
		],
		// Per-test durations; CI uploads them with every run.
		[
			"junit",
			{
				outputFile: "../../reports/e2e.xml",
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
				...(withInstance
					? [
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
						]
					: []),
				{
					name: "chromium",
					testIgnore:
						/(setup\/.*\.setup\.ts|tests\/(instance|pipeline)\/.*\.spec\.ts)$/,
					dependencies: [
						withInstance ? "instance" : "setup",
					],
					use: {
						...devices["Desktop Chrome"],
					},
				},
			],
	// Started in order. The mock inference server comes first: the setup
	// project saves it as the embedding endpoint, which runs a test embedding.
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
			command: container(process.env.E2E_APP_IMAGE as string),
			url: baseURL,
			reuseExistingServer: true,
			timeout: 60_000,
			gracefulShutdown,
			stdout: "ignore",
			stderr: "pipe",
		},
		...(isPipeline
			? [
					// Ready once every queue exists and every worker is registered.
					{
						command: container(process.env.E2E_WORKERS_IMAGE as string),
						wait: {
							stdout: /background workers started/,
						},
						timeout: 60_000,
						gracefulShutdown,
						stdout: "ignore" as const,
						stderr: "pipe" as const,
					},
				]
			: [
					// The docs site the assistant reads (`WEB_INTERNAL_URL`); it needs
					// no stack services. A running `bun run stack web` is reused.
					{
						command: container(process.env.E2E_WEB_IMAGE as string, [
							`--env PORT=${process.env.WEB_PORT as string}`,
						]),
						url: `${docsURL}/llms.txt`,
						reuseExistingServer: true,
						timeout: 60_000,
						gracefulShutdown,
						stdout: "ignore" as const,
						stderr: "pipe" as const,
					},
				]),
	],
});
