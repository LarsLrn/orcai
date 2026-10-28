/** Writes the devcontainer's own env file once, when the container is created. */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomSecret, serializeEnv } from "./stack";

export function writeDevcontainerEnv(file: string): boolean {
	if (existsSync(file)) return false;
	writeFileSync(
		file,
		serializeEnv(
			{
				PORT: "3000",
				WEB_PORT: "3001",
				BETTER_AUTH_SECRET: randomSecret(48),
				ENCRYPTION_KEY: randomSecret(32),
				OPENAI_COMPATIBLE_BASE_URL: "http://host.docker.internal:11434/v1",
				OPENAI_COMPATIBLE_API_KEY: "ollama",
				EMBEDDING_MODEL: "baai/bge-m3",
				EMBEDDING_DIMENSIONS: "1024",
			},
			[
				"Generated once for the devcontainer by `bun scripts/devcontainer-env.ts`.",
				"Overrides the container environment for `bun run dev`, `dev:all` and `stack workers|web|exec`.",
				"Keep ENCRYPTION_KEY: stored provider keys are encrypted with it.",
			],
		),
	);
	return true;
}

if (import.meta.main) {
	const envFile = process.env.ORCAI_ENV_FILE;
	if (!envFile) {
		throw new Error(
			"ORCAI_ENV_FILE is not set; run this inside the devcontainer",
		);
	}
	const file = path.resolve(import.meta.dirname, "..", envFile);
	const wrote = writeDevcontainerEnv(file);
	console.log(`[devcontainer] ${wrote ? "Wrote" : "Kept"} ${file}`);
}
