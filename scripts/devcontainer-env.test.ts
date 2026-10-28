import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeDevcontainerEnv } from "./devcontainer-env";
import { parseEnv } from "./stack";

describe("writeDevcontainerEnv", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), "devcontainer-env-"));
	});

	afterEach(() => {
		rmSync(dir, {
			recursive: true,
			force: true,
		});
	});

	test("writes the ports, fresh secrets and inference defaults", () => {
		const file = path.join(dir, ".env");

		expect(writeDevcontainerEnv(file)).toBe(true);

		const env = parseEnv(readFileSync(file, "utf8"));
		expect(Object.keys(env).sort()).toEqual([
			"BETTER_AUTH_SECRET",
			"EMBEDDING_DIMENSIONS",
			"EMBEDDING_MODEL",
			"ENCRYPTION_KEY",
			"OPENAI_COMPATIBLE_API_KEY",
			"OPENAI_COMPATIBLE_BASE_URL",
			"PORT",
			"WEB_PORT",
		]);
		expect(env.PORT).toBe("3000");
		expect(env.WEB_PORT).toBe("3001");
		expect(env.ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
		expect(env.BETTER_AUTH_SECRET).toMatch(/^[0-9a-f]{96}$/);
		expect(
			Object.values(env).some((value) => value.includes("127.0.0.1")),
		).toBe(false);
	});

	test("never rewrites an existing file", () => {
		const file = path.join(dir, ".env");
		writeDevcontainerEnv(file);
		const before = readFileSync(file);

		expect(writeDevcontainerEnv(file)).toBe(false);
		expect(readFileSync(file)).toEqual(before);
	});

	test("gives every new file its own secrets", () => {
		const first = path.join(dir, "first.env");
		const second = path.join(dir, "second.env");
		writeDevcontainerEnv(first);
		writeDevcontainerEnv(second);

		const a = parseEnv(readFileSync(first, "utf8"));
		const b = parseEnv(readFileSync(second, "utf8"));
		expect(a.ENCRYPTION_KEY).not.toBe(b.ENCRYPTION_KEY);
		expect(a.BETTER_AUTH_SECRET).not.toBe(b.BETTER_AUTH_SECRET);
	});
});
