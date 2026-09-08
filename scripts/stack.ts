/**
 * OrcAI development stack.
 *
 * One command per worktree that owns the backing services (PostgreSQL, Valkey,
 * MinIO, Qdrant, SpiceDB) in an isolated Docker Compose project, picks free
 * loopback ports, writes them to `.env`, applies migrations, and runs the app
 * with that environment.
 *
 * Usage: bun run stack <command> [options]
 *
 *   up [--reset]           Start infrastructure, write .env, run migrations.
 *   down [--volumes]       Stop infrastructure. --volumes also deletes data.
 *   status                 Show container state and probe every service.
 *   env [--reset]          Print the path and content of the resolved .env.
 *   migrate                Apply database migrations and the SpiceDB schema.
 *   reset                  Empty every store, then reapply migrations.
 *   e2e [--no-reset]       Reset, then run the Playwright suite.
 *   dev [--all]            Run the app dev server. --all adds workers and web.
 *   workers                Run the background workers.
 *   web                    Run the docs site dev server.
 *   logs [service...]      Follow infrastructure logs.
 *   exec -- <cmd...>       Run any command with the stack environment.
 *
 * Everything after `--` reaches the subcommand unchanged, so
 * `bun run stack e2e -- --grep auth` and `bun run stack e2e -- --ui` forward
 * those arguments to Playwright.
 *
 * `reset` wipes the data of every store (PostgreSQL, SpiceDB relationships,
 * MinIO objects, Qdrant collections, Valkey keys) while leaving the containers
 * and `.env` in place; `e2e` does the same unless `--no-reset` is given. Both
 * refuse to run unless POSTGRES_HOST is a loopback address, the stack is named
 * `orcai-*`, and nothing is listening on the app port. There is no override.
 * `e2e --no-reset` reuses an app already listening on PORT, for example
 * `bun run stack dev`, and skips the production build. An e2e run also starts
 * a mock inference server on E2E_INFERENCE_PORT and points the app's global
 * OpenAI-compatible endpoint at it; a reused app keeps its own endpoint.
 *
 * `reset`, `e2e` without `--no-reset`, and `down --volumes` ask before they
 * destroy anything. `--yes` answers the question up front, and a caller
 * without a terminal has to pass it.
 *
 * Global options:
 *   --name <stack>         Compose project name. Defaults to orcai-<worktree>.
 *   --env-file <path>      Env file. Defaults to <repo>/.env.
 *   --yes                  Skip the confirmation of a destructive command.
 *
 * Overrides shared by every worktree on this machine can live in
 * `~/.config/orcai/dev.env` (or the file named by ORCAI_DEV_ENV_FILE). They are
 * merged on top of the generated defaults whenever `.env` is (re)created.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import * as Bun from "bun";

const repoRoot = path.resolve(import.meta.dirname, "..");
const infraServices = [
	"postgres",
	"valkey",
	"minio",
	"minio-setup",
	"qdrant",
	"spicedb-database",
	"spicedb-migrate",
	"spicedb",
];
const portKeys = [
	"PORT",
	"WEB_PORT",
	"POSTGRES_PORT",
	"VALKEY_PORT",
	"MINIO_API_PORT",
	"MINIO_CONSOLE_PORT",
	"QDRANT_HTTP_PORT",
	"QDRANT_GRPC_PORT",
	"SPICEDB_GRPC_PORT",
	"SPICEDB_HTTP_PORT",
	"SPICEDB_POSTGRES_PORT",
	"E2E_INFERENCE_PORT",
] as const;
type PortKey = (typeof portKeys)[number];
type Ports = Record<PortKey, number>;
type Env = Record<string, string>;

interface Options {
	command: string;
	args: string[];
	flags: Set<string>;
	stackName: string;
	envFile: string;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

export function parseOptions(argv: string[]): Options {
	const args: string[] = [];
	const flags = new Set<string>();
	let stackName: string | undefined = process.env.ORCAI_STACK_NAME;
	let envFile: string | undefined = process.env.ORCAI_ENV_FILE;
	let passthrough = false;

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index] ?? "";
		if (passthrough) {
			args.push(value);
			continue;
		}
		if (value === "--") {
			passthrough = true;
			continue;
		}
		if (value === "--name") {
			stackName = argv[++index];
			if (!stackName || stackName.startsWith("--"))
				throw new Error("--name requires a value");
			continue;
		}
		if (value === "--env-file") {
			envFile = argv[++index];
			if (!envFile || envFile.startsWith("--"))
				throw new Error("--env-file requires a value");
			continue;
		}
		if (value.startsWith("-")) {
			if (
				![
					"--help",
					"--all",
					"--no-reset",
					"--reset",
					"--volumes",
					"--yes",
				].includes(value)
			) {
				throw new Error(
					`Unknown flag '${value}'. Put delegated arguments after --.`,
				);
			}
			flags.add(value.slice(2));
			continue;
		}
		args.push(value);
	}

	const command = flags.has("help") ? "help" : (args.shift() ?? "help");
	return {
		command,
		args,
		flags,
		stackName: sanitizeStackName(
			stackName ?? `orcai-${path.basename(repoRoot)}`,
		),
		envFile: path.resolve(repoRoot, envFile ?? ".env"),
	};
}

function sanitizeStackName(value: string): string {
	const sanitized = value
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^[^a-z0-9]+/, "");
	if (sanitized.length === 0) {
		throw new Error(`Cannot derive a Compose project name from '${value}'`);
	}
	return sanitized;
}

// ---------------------------------------------------------------------------
// Env file handling
// ---------------------------------------------------------------------------

function parseEnv(content: string): Env {
	const env: Env = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const separator = line.indexOf("=");
		if (separator === -1) continue;
		const key = line
			.slice(0, separator)
			.trim()
			.replace(/^export\s+/, "");
		let value = line.slice(separator + 1).trim();
		const quoted = /^(["']).*\1$/.exec(value);
		if (quoted) {
			value = value.slice(1, -1);
		} else {
			const comment = value.indexOf(" #");
			if (comment !== -1) value = value.slice(0, comment).trim();
		}
		env[key] = value;
	}
	return env;
}

function serializeEnv(env: Env, header: string[]): string {
	const lines = header.map((line) => `# ${line}`);
	lines.push("");
	for (const [key, value] of Object.entries(env)) {
		const needsQuotes = /[\s#"'$]/.test(value) || value.length === 0;
		lines.push(`${key}=${needsQuotes ? JSON.stringify(value) : value}`);
	}
	lines.push("");
	return lines.join("\n");
}

function readEnvFile(file: string): Env | null {
	if (!existsSync(file)) return null;
	return parseEnv(readFileSync(file, "utf8"));
}

function userOverlayFile(): string {
	return (
		process.env.ORCAI_DEV_ENV_FILE ??
		path.join(
			process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"),
			"orcai",
			"dev.env",
		)
	);
}

function defaultEnv(stackName: string, ports: Ports): Env {
	const appUrl = `http://127.0.0.1:${String(ports.PORT)}`;
	const webUrl = `http://127.0.0.1:${String(ports.WEB_PORT)}`;
	const minioUrl = `http://127.0.0.1:${String(ports.MINIO_API_PORT)}`;
	return {
		ORCAI_STACK_NAME: stackName,

		PORT: String(ports.PORT),
		WEB_PORT: String(ports.WEB_PORT),
		BASE_URL: appUrl,
		BETTER_AUTH_URL: appUrl,
		VITE_BASE_URL: appUrl,
		VITE_WEB_URL: webUrl,

		BETTER_AUTH_SECRET: randomSecret(48),
		ENCRYPTION_KEY: randomSecret(32),

		POSTGRES_USER: "postgres",
		POSTGRES_PASSWORD: "postgres",
		POSTGRES_HOST: "127.0.0.1",
		POSTGRES_PORT: String(ports.POSTGRES_PORT),
		POSTGRES_DB: "app",
		POSTGRES_SSL: "false",

		VALKEY_PORT: String(ports.VALKEY_PORT),
		VALKEY_URL: `redis://127.0.0.1:${String(ports.VALKEY_PORT)}`,

		MINIO_API_PORT: String(ports.MINIO_API_PORT),
		MINIO_CONSOLE_PORT: String(ports.MINIO_CONSOLE_PORT),
		MINIO_ROOT_USER: "minioadmin",
		MINIO_ROOT_PASSWORD: "minioadmin",
		S3_ENDPOINT: minioUrl,
		S3_PUBLIC_ENDPOINT: minioUrl,
		S3_REGION: "eu-central-1",
		S3_ACCESS_KEY: "minioadmin",
		S3_SECRET_KEY: "minioadmin",

		QDRANT_HTTP_PORT: String(ports.QDRANT_HTTP_PORT),
		QDRANT_GRPC_PORT: String(ports.QDRANT_GRPC_PORT),
		QDRANT_URL: `http://127.0.0.1:${String(ports.QDRANT_HTTP_PORT)}/`,
		QDRANT_API_KEY: "dev-qdrant-key",

		SPICEDB_GRPC_PORT: String(ports.SPICEDB_GRPC_PORT),
		SPICEDB_HTTP_PORT: String(ports.SPICEDB_HTTP_PORT),
		SPICEDB_POSTGRES_PORT: String(ports.SPICEDB_POSTGRES_PORT),
		SPICEDB_ENDPOINT: `127.0.0.1:${String(ports.SPICEDB_GRPC_PORT)}`,
		SPICEDB_TOKEN: "dev-spicedb-token",
		SPICEDB_GRPC_PRESHARED_KEY: "dev-spicedb-token",
		SPICEDB_SECURITY: "insecure-plaintext",
		SPICEDB_POSTGRES_USER: "postgres",
		SPICEDB_POSTGRES_PASSWORD: "postgres",

		// No inference endpoint ships with the stack. Point these at a real
		// OpenAI-compatible endpoint (for example through ~/.config/orcai/dev.env)
		// before exercising embeddings or image descriptions.
		OPENAI_COMPATIBLE_BASE_URL: "http://127.0.0.1:11434/v1",
		OPENAI_COMPATIBLE_API_KEY: "dev-openai-compatible-key",
		EMBEDDING_MODEL: "baai/bge-m3",
		EMBEDDING_DIMENSIONS: "1024",
		GENERAL_MODEL: "google/gemma-4-26b-a4b-it",

		// Workers on the host need Tesseract with matching language packs.
		KREUZBERG_OCR_LANGUAGE: "eng",

		// Loopback port of the mock inference server an e2e run starts; see
		// `e2eEnv`.
		E2E_INFERENCE_PORT: String(ports.E2E_INFERENCE_PORT),
	};
}

function randomSecret(bytes: number): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(
		"hex",
	);
}

async function createEnv(options: Options): Promise<Env> {
	const ports = await allocatePorts(options.stackName);
	const env = defaultEnv(options.stackName, ports);
	const overlayFile = userOverlayFile();
	const overlay = readEnvFile(overlayFile);
	if (overlay) {
		Object.assign(env, overlay);
		log(`Applied overrides from ${overlayFile}`);
	}
	mkdirSync(path.dirname(options.envFile), {
		recursive: true,
	});
	writeFileSync(
		options.envFile,
		serializeEnv(env, [
			`Generated by \`bun run stack up\` for Compose project '${options.stackName}'.`,
			"Edit freely; values persist until `bun run stack env --reset`.",
			`Machine-wide overrides: ${overlayFile}`,
		]),
	);
	log(`Wrote ${options.envFile}`);
	return env;
}

async function loadOrCreateEnv(options: Options, reset = false): Promise<Env> {
	if (!reset) {
		const existing = readEnvFile(options.envFile);
		if (existing) return existing;
	}
	return await createEnv(options);
}

function requireEnv(options: Options): Env {
	const env = readEnvFile(options.envFile);
	if (!env) {
		throw new Error(
			`${options.envFile} does not exist. Run \`bun run stack up\` first.`,
		);
	}
	return env;
}

// ---------------------------------------------------------------------------
// Port allocation
// ---------------------------------------------------------------------------

const portRangeStart = 20000;
const portRangeEnd = 60000;
const portBlockSize = 20;

async function allocatePorts(stackName: string): Promise<Ports> {
	// Derive a stable starting block from the stack name so a recreated .env
	// usually lands on the same ports, then probe forward until a whole block
	// is free.
	const blocks = Math.floor((portRangeEnd - portRangeStart) / portBlockSize);
	const startBlock = Bun.hash.xxHash32(stackName) % blocks;
	for (let offset = 0; offset < blocks; offset += 1) {
		const base =
			portRangeStart + ((startBlock + offset) % blocks) * portBlockSize;
		const candidates = portKeys.map((_, index) => base + index);
		const free = await Promise.all(candidates.map(isPortFree));
		if (free.every(Boolean)) {
			return Object.fromEntries(
				portKeys.map((key, index) => [
					key,
					candidates[index],
				]),
			) as Ports;
		}
	}
	throw new Error(
		`No free port block between ${String(portRangeStart)} and ${String(portRangeEnd)}`,
	);
}

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.unref();
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => {
			server.close((error) => resolve(!error));
		});
	});
}

// ---------------------------------------------------------------------------
// Docker Compose
// ---------------------------------------------------------------------------

function composeArgs(options: Options): string[] {
	return [
		"compose",
		"--project-name",
		options.stackName,
		"--file",
		path.join(repoRoot, "docker-compose.yaml"),
		"--file",
		path.join(repoRoot, "docker-compose.infra.yaml"),
	];
}

function withEnv(env: Env): Env {
	return {
		...(process.env as Env),
		...env,
	};
}

async function compose(
	options: Options,
	env: Env,
	args: string[],
	quiet = false,
): Promise<number> {
	const proc = Bun.spawn(
		[
			"docker",
			...composeArgs(options),
			...args,
		],
		{
			cwd: repoRoot,
			env: withEnv(env),
			stdin: "inherit",
			stdout: quiet ? "ignore" : "inherit",
			stderr: "inherit",
		},
	);
	return await proc.exited;
}

const oneShotServices = [
	"minio-setup",
	"spicedb-migrate",
];
const longRunningServices = infraServices.filter(
	(service) => !oneShotServices.includes(service),
);

async function composeUp(options: Options, env: Env): Promise<void> {
	log(`Starting infrastructure for '${options.stackName}'`);
	// Start everything (Compose orders the one-shot bootstrap containers via
	// depends_on), then block until the long-running services report healthy.
	// `--wait` treats an exited one-shot container as a failure, so it only
	// covers the long-running set.
	const started = await compose(options, env, [
		"up",
		"--detach",
		"--quiet-pull",
		...infraServices,
	]);
	if (started !== 0) {
		throw new Error(
			`docker compose up exited with code ${String(started)}. If a port is taken, run \`bun run stack env --reset\` and retry.`,
		);
	}
	const healthy = await compose(options, env, [
		"up",
		"--detach",
		"--wait",
		"--no-deps",
		...longRunningServices,
	]);
	if (healthy !== 0) {
		throw new Error("Infrastructure did not become healthy in time");
	}
	await assertOneShotsSucceeded(options, env);
}

async function composeCapture(
	options: Options,
	env: Env,
	args: string[],
): Promise<string> {
	const proc = Bun.spawn(
		[
			"docker",
			...composeArgs(options),
			...args,
		],
		{
			cwd: repoRoot,
			env: withEnv(env),
			stdout: "pipe",
			stderr: "inherit",
		},
	);
	const output = await new Response(proc.stdout).text();
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(
			`docker compose ${args[0] ?? ""} exited with code ${String(code)}`,
		);
	}
	return output;
}

async function assertOneShotsSucceeded(
	options: Options,
	env: Env,
): Promise<void> {
	const output = await composeCapture(options, env, [
		"ps",
		"--all",
		"--format",
		"json",
		...oneShotServices,
	]);
	for (const line of output.split("\n").filter((entry) => entry.trim())) {
		const container = JSON.parse(line) as {
			Service: string;
			State: string;
			ExitCode: number;
		};
		if (container.State === "exited" && container.ExitCode !== 0) {
			throw new Error(
				`Bootstrap service '${container.Service}' exited with code ${String(container.ExitCode)}. Inspect it with \`bun run stack logs ${container.Service}\`.`,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Running workspace commands with the stack environment
// ---------------------------------------------------------------------------

async function run(
	command: string[],
	env: Env,
	cwd = repoRoot,
): Promise<number> {
	const proc = Bun.spawn(command, {
		cwd,
		env: withEnv(env),
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
	forwardSignals(proc);
	return await proc.exited;
}

function forwardSignals(proc: Bun.Subprocess): void {
	for (const signal of [
		"SIGINT",
		"SIGTERM",
	] as const) {
		process.on(signal, () => {
			proc.kill(signal);
		});
	}
}

async function runOrThrow(
	label: string,
	command: string[],
	env: Env,
): Promise<void> {
	log(label);
	const code = await run(command, env);
	if (code !== 0) {
		throw new Error(`${label} failed with exit code ${String(code)}`);
	}
}

async function migrate(env: Env): Promise<void> {
	await runOrThrow(
		"Applying database migrations",
		[
			"bun",
			"run",
			"--filter",
			"@orcai/db",
			"migrate",
		],
		env,
	);
	await runOrThrow(
		"Applying SpiceDB schema",
		[
			"bun",
			"run",
			"--filter",
			"@orcai/spice-db",
			"up",
		],
		env,
	);
}

/**
 * When Paseo starts a service script it hands over the port it proxies and the
 * public URL of that proxy. Prefer those so the browser, Better Auth, and the
 * client bundle all agree on one origin.
 */
function appEnv(env: Env): Env {
	const paseoPort = process.env.PASEO_PORT;
	const paseoUrl = process.env.PASEO_URL;
	const webUrl = process.env.PASEO_SERVICE_WEB_URL;
	const result: Env = {
		...env,
	};
	if (paseoPort) result.PORT = paseoPort;
	if (paseoUrl) {
		result.BASE_URL = paseoUrl;
		result.BETTER_AUTH_URL = paseoUrl;
		result.VITE_BASE_URL = paseoUrl;
	}
	if (webUrl) result.VITE_WEB_URL = webUrl;
	return result;
}

function webEnv(env: Env): Env {
	return {
		...env,
		PORT: process.env.PASEO_PORT ?? env.WEB_PORT ?? "3001",
	};
}

function workspaceScript(filter: string, script: string): string[] {
	return [
		"bun",
		"run",
		"--filter",
		filter,
		script,
	];
}

async function runDev(options: Options, env: Env): Promise<number> {
	if (!options.flags.has("all")) {
		return await run(workspaceScript("@orcai/app", "dev"), appEnv(env));
	}
	const children = [
		Bun.spawn(workspaceScript("@orcai/app", "dev"), {
			cwd: repoRoot,
			env: withEnv(appEnv(env)),
			stdout: "inherit",
			stderr: "inherit",
		}),
		Bun.spawn(workspaceScript("@orcai/workers", "dev"), {
			cwd: repoRoot,
			env: withEnv(env),
			stdout: "inherit",
			stderr: "inherit",
		}),
		Bun.spawn(workspaceScript("@orcai/web", "dev"), {
			cwd: repoRoot,
			env: withEnv(webEnv(env)),
			stdout: "inherit",
			stderr: "inherit",
		}),
	];
	const stopAll = () => {
		for (const child of children) child.kill();
	};
	process.on("SIGINT", stopAll);
	process.on("SIGTERM", stopAll);
	const codes = await Promise.all(children.map((child) => child.exited));
	return codes.find((code) => code !== 0) ?? 0;
}

// ---------------------------------------------------------------------------
// Data reset
// ---------------------------------------------------------------------------

const loopbackHosts = new Set([
	"127.0.0.1",
	"localhost",
	"::1",
]);

/**
 * A reset destroys data, so it only ever runs against a stack this script owns
 * on this machine. There is no override.
 */
async function assertResettable(options: Options, env: Env): Promise<void> {
	const host = env.POSTGRES_HOST ?? "";
	if (!loopbackHosts.has(host)) {
		throw new Error(
			`Refusing to reset '${options.stackName}': POSTGRES_HOST is '${host}', not a loopback address.`,
		);
	}
	if (!options.stackName.startsWith("orcai-")) {
		throw new Error(
			`Refusing to reset: stack '${options.stackName}' is not named 'orcai-*'.`,
		);
	}
	// A running app keeps state in memory (the bootstrap status, the pg-boss
	// schema it created on start) that a reset would silently invalidate.
	if (await isAppListening(env)) {
		throw new Error(
			`Refusing to reset: an app is listening on ${env.BASE_URL ?? ""}. Stop it first, or run \`bun run stack e2e --no-reset\` to test against it.`,
		);
	}
}

const affirmatives = new Set([
	"y",
	"yes",
]);

/**
 * Ask before destroying data. `--yes` skips the question, which every
 * non-interactive caller has to pass; without a terminal there is nobody to
 * answer, so the command refuses rather than assuming consent.
 */
function confirmDestructive(options: Options, warning: string): void {
	if (options.flags.has("yes")) return;
	if (!process.stdin.isTTY) {
		throw new Error(`${warning} Pass --yes to confirm non-interactively.`);
	}
	const answer = prompt(`${warning} Continue? [y/N]`);
	if (!affirmatives.has((answer ?? "").trim().toLowerCase())) {
		throw new Error("Aborted.");
	}
}

/**
 * Whether anything accepts a TCP connection on the app port.
 *
 * A dev server that is still compiling answers the socket long before it
 * answers a request, so the connect alone decides. An HTTP probe would time
 * out against a cold server and let the reset drop the database under it.
 */
async function isAppListening(env: Env): Promise<boolean> {
	return await tcpProbe("127.0.0.1", envValue(env, "PORT"))();
}

function envValue(env: Env, key: string): string {
	const value = env[key];
	if (!value) {
		throw new Error(`${key} is missing from the env file`);
	}
	return value;
}

async function resetPostgres(env: Env): Promise<void> {
	const database = envValue(env, "POSTGRES_DB");
	if (!/^[a-z0-9_]+$/i.test(database)) {
		throw new Error(`POSTGRES_DB '${database}' is not a plain identifier`);
	}
	const admin = new Bun.SQL({
		hostname: envValue(env, "POSTGRES_HOST"),
		port: Number(envValue(env, "POSTGRES_PORT")),
		username: envValue(env, "POSTGRES_USER"),
		password: envValue(env, "POSTGRES_PASSWORD"),
		database: "postgres",
		max: 1,
	});
	try {
		// A dev server or worker holding sessions open would block DROP DATABASE.
		await admin`select pg_terminate_backend(pid)
			from pg_stat_activity
			where datname = ${database} and pid <> pg_backend_pid()`;
		await admin.unsafe(`drop database if exists "${database}"`);
		await admin.unsafe(`create database "${database}"`);
	} finally {
		await admin.end();
	}
	log(`Recreated PostgreSQL database '${database}'`);
}

async function resetSpiceDb(env: Env): Promise<void> {
	await runOrThrow(
		"Deleting SpiceDB relationships",
		[
			...workspaceScript("@orcai/spice-db", "reset"),
			"--yes",
		],
		env,
	);
}

/**
 * `mc` only ships in the minio-setup image, which is also what created the
 * buckets, so both the listing and the deletion run there. The alias is passed
 * through the environment so the credentials stay off the command line.
 */
function mcArgs(args: string[]): string[] {
	return [
		"run",
		"--rm",
		"--no-deps",
		"--env",
		"MC_HOST_stack",
		"--entrypoint",
		"/usr/bin/mc",
		"minio-setup",
		...args,
	];
}

async function resetMinio(options: Options, env: Env): Promise<void> {
	const user = encodeURIComponent(envValue(env, "MINIO_ROOT_USER"));
	const password = encodeURIComponent(envValue(env, "MINIO_ROOT_PASSWORD"));
	const mcEnv: Env = {
		...env,
		MC_HOST_stack: `http://${user}:${password}@minio:9000`,
	};
	const listing = await composeCapture(
		options,
		mcEnv,
		mcArgs([
			"ls",
			"--json",
			"stack",
		]),
	);
	const buckets = listing
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map(
			(line) =>
				JSON.parse(line) as {
					status: string;
					key: string;
				},
		)
		.filter((entry) => entry.status === "success" && entry.key.endsWith("/"))
		.map((entry) => `stack/${entry.key}`);
	if (buckets.length > 0) {
		await composeCapture(
			options,
			mcEnv,
			mcArgs([
				"rm",
				"--recursive",
				"--force",
				"--quiet",
				...buckets,
			]),
		);
	}
	log(`Emptied ${String(buckets.length)} MinIO buckets`);
}

async function resetQdrant(env: Env): Promise<void> {
	const base = envValue(env, "QDRANT_URL").replace(/\/$/, "");
	const headers = {
		"api-key": envValue(env, "QDRANT_API_KEY"),
	};
	const listed = await fetch(`${base}/collections`, {
		headers,
	});
	if (!listed.ok) {
		throw new Error(
			`Qdrant answered ${String(listed.status)} when listing collections`,
		);
	}
	const body = (await listed.json()) as {
		result: {
			collections: {
				name: string;
			}[];
		};
	};
	for (const collection of body.result.collections) {
		const deleted = await fetch(
			`${base}/collections/${encodeURIComponent(collection.name)}`,
			{
				method: "DELETE",
				headers,
			},
		);
		if (!deleted.ok) {
			throw new Error(
				`Qdrant answered ${String(deleted.status)} when deleting collection '${collection.name}'`,
			);
		}
	}
	log(`Deleted ${String(body.result.collections.length)} Qdrant collections`);
}

async function resetValkey(env: Env): Promise<void> {
	const client = new Bun.RedisClient(envValue(env, "VALKEY_URL"));
	try {
		await client.send("FLUSHALL", []);
	} finally {
		client.close();
	}
	log("Flushed Valkey");
}

/**
 * Empty every store of a stack while leaving its containers and env file in
 * place, so that the next run starts from an uninitialised instance.
 */
async function reset(options: Options, env: Env): Promise<void> {
	await assertResettable(options, env);
	confirmDestructive(
		options,
		`Resetting '${options.stackName}' deletes its database, authorisation, object storage, vector, and cache data.`,
	);
	log(`Resetting the data of '${options.stackName}'`);
	await resetPostgres(env);
	await migrate(env);
	await resetSpiceDb(env);
	await resetMinio(options, env);
	await resetQdrant(env);
	await resetValkey(env);
}

/**
 * The e2e suite runs a mock OpenAI-compatible server
 * (`apps/e2e/fixtures/inference/serve.ts`) on `E2E_INFERENCE_PORT` and points
 * the app's global inference endpoint at it, so embeddings and chat titles
 * never reach a real provider. Env files written before the port existed get
 * the slot the allocator would have chosen. With `--no-reset` and an app
 * already listening, that app keeps the endpoint it was started with.
 */
function e2eEnv(env: Env): Env {
	const inferencePort =
		env.E2E_INFERENCE_PORT ??
		String(
			Number(envValue(env, "PORT")) + portKeys.indexOf("E2E_INFERENCE_PORT"),
		);
	return {
		...env,
		E2E_INFERENCE_PORT: inferencePort,
		OPENAI_COMPATIBLE_BASE_URL: `http://127.0.0.1:${inferencePort}/v1`,
		OPENAI_COMPATIBLE_API_KEY: "e2e-mock-key",
		GENERAL_MODEL: "e2e-mock-chat",
		EMBEDDING_MODEL: "e2e-mock-embedding",
	};
}

async function runE2e(options: Options, env: Env): Promise<number> {
	if (!options.flags.has("no-reset")) {
		await reset(options, env);
	}
	log(
		[
			"Running Playwright",
			...options.args,
		].join(" "),
	);
	return await run(
		[
			"bunx",
			"--no-install",
			"playwright",
			"test",
			...options.args,
		],
		e2eEnv(env),
		path.join(repoRoot, "apps", "e2e"),
	);
}

// ---------------------------------------------------------------------------
// Status probes
// ---------------------------------------------------------------------------

interface Probe {
	name: string;
	check: () => Promise<boolean>;
	detail: string;
}

/**
 * A probe that resolves true when the host accepts a TCP connection on the
 * port. Connecting is all it takes, so a server that is up but still busy
 * still counts as listening.
 */
function tcpProbe(host: string, port: string): () => Promise<boolean> {
	return () =>
		new Promise<boolean>((resolve) => {
			const socket = net.connect({
				host,
				port: Number(port),
			});
			socket.setTimeout(2000);
			socket.once("connect", () => {
				socket.destroy();
				resolve(true);
			});
			socket.once("error", () => resolve(false));
			socket.once("timeout", () => {
				socket.destroy();
				resolve(false);
			});
		});
}

function probes(env: Env): Probe[] {
	const http =
		(url: string, headers: Record<string, string> = {}) =>
		async () => {
			try {
				const response = await fetch(url, {
					headers,
					signal: AbortSignal.timeout(2000),
				});
				return response.ok;
			} catch {
				return false;
			}
		};
	return [
		{
			name: "postgres",
			check: tcpProbe(
				env.POSTGRES_HOST ?? "127.0.0.1",
				env.POSTGRES_PORT ?? "",
			),
			detail: `${env.POSTGRES_HOST ?? ""}:${env.POSTGRES_PORT ?? ""}/${env.POSTGRES_DB ?? ""}`,
		},
		{
			name: "valkey",
			check: tcpProbe("127.0.0.1", env.VALKEY_PORT ?? ""),
			detail: env.VALKEY_URL ?? "",
		},
		{
			name: "minio",
			check: http(`${env.S3_ENDPOINT ?? ""}/minio/health/live`),
			detail: env.S3_ENDPOINT ?? "",
		},
		{
			name: "qdrant",
			check: http(`${env.QDRANT_URL ?? ""}healthz`, {
				"api-key": env.QDRANT_API_KEY ?? "",
			}),
			detail: env.QDRANT_URL ?? "",
		},
		{
			name: "spicedb",
			check: tcpProbe("127.0.0.1", env.SPICEDB_GRPC_PORT ?? ""),
			detail: env.SPICEDB_ENDPOINT ?? "",
		},
		{
			name: "app",
			check: http(env.BASE_URL ?? ""),
			detail: `${env.BASE_URL ?? ""} (only while \`bun run stack dev\` runs)`,
		},
	];
}

async function status(options: Options, env: Env): Promise<number> {
	await compose(options, env, [
		"ps",
		"--all",
	]);
	console.log("");
	let failures = 0;
	for (const probe of probes(env)) {
		const ok = await probe.check();
		if (!ok && probe.name !== "app") failures += 1;
		console.log(
			`${ok ? "  up  " : " down "} ${probe.name.padEnd(9)} ${probe.detail}`,
		);
	}
	return failures === 0 ? 0 : 1;
}

function printSummary(options: Options, env: Env): void {
	console.log("");
	console.log(`Stack '${options.stackName}' is ready.`);
	console.log(`  env file       ${options.envFile}`);
	console.log(`  app            ${env.BASE_URL ?? ""}  (bun run stack dev)`);
	console.log(
		`  docs           ${env.VITE_WEB_URL ?? ""}  (bun run stack web)`,
	);
	console.log(
		`  postgres       ${env.POSTGRES_HOST ?? ""}:${env.POSTGRES_PORT ?? ""}`,
	);
	console.log(
		`  minio console  http://127.0.0.1:${env.MINIO_CONSOLE_PORT ?? ""}`,
	);
	console.log(`  qdrant         ${env.QDRANT_URL ?? ""}`);
	console.log(`  spicedb        ${env.SPICEDB_ENDPOINT ?? ""}`);
	console.log("");
}

function log(message: string): void {
	console.log(`[stack] ${message}`);
}

function printHelp(): void {
	const source = readFileSync(import.meta.path, "utf8");
	const doc = /\/\*\*([\s\S]*?)\*\//.exec(source)?.[1] ?? "";
	console.log(
		doc
			.split("\n")
			.map((line) => line.replace(/^\s*\* ?/, ""))
			.join("\n")
			.trim(),
	);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
	const options = parseOptions(process.argv.slice(2));

	switch (options.command) {
		case "up": {
			const env = await loadOrCreateEnv(options, options.flags.has("reset"));
			await composeUp(options, env);
			await migrate(env);
			printSummary(options, env);
			return 0;
		}
		case "down": {
			const env = readEnvFile(options.envFile) ?? {};
			const args = [
				"down",
				"--remove-orphans",
			];
			if (options.flags.has("volumes")) {
				confirmDestructive(
					options,
					`Removing the volumes of '${options.stackName}' deletes its stored data.`,
				);
				args.push("--volumes");
			}
			// Compose still interpolates the override file on `down`; feed
			// placeholders when the env file is already gone.
			const placeholders = Object.fromEntries(
				portKeys.map((key) => [
					key,
					env[key] ?? "0",
				]),
			);
			return await compose(
				options,
				{
					QDRANT_API_KEY: "unused",
					...placeholders,
					...env,
				},
				args,
			);
		}
		case "status":
			return await status(options, requireEnv(options));
		case "env": {
			const env = await loadOrCreateEnv(options, options.flags.has("reset"));
			console.log(`# ${options.envFile}`);
			console.log(serializeEnv(env, []).trim());
			return 0;
		}
		case "migrate":
			await migrate(requireEnv(options));
			return 0;
		case "reset":
			await reset(options, requireEnv(options));
			return 0;
		case "e2e":
			return await runE2e(options, requireEnv(options));
		case "dev":
			return await runDev(options, requireEnv(options));
		case "workers":
			return await run(
				workspaceScript("@orcai/workers", "dev"),
				requireEnv(options),
			);
		case "web":
			return await run(
				workspaceScript("@orcai/web", "dev"),
				webEnv(requireEnv(options)),
			);
		case "logs":
			return await compose(options, requireEnv(options), [
				"logs",
				"--follow",
				...options.args,
			]);
		case "exec": {
			if (options.args.length === 0) {
				throw new Error("Usage: bun run stack exec -- <command...>");
			}
			return await run(options.args, requireEnv(options));
		}
		case "help":
			printHelp();
			return 0;
		default:
			printHelp();
			throw new Error(`Unknown command '${options.command}'`);
	}
}

if (import.meta.main) {
	try {
		process.exit(await main());
	} catch (error) {
		console.error(
			`[stack] ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}
