import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { runConvergeStatus, runConvergeUp } from "../src/converge";
import { defaultSpiceDbSchemaPath } from "../src/converge/lib";
import { SpiceDbLive } from "../src/service";

const runtime = ManagedRuntime.make(SpiceDbLive);
let directory: string;
let schema: string;

beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), "spice-db-converge-"));
	schema = await readFile(defaultSpiceDbSchemaPath, "utf8");
	await runtime.runPromise(runConvergeUp());
});

afterAll(async () => {
	await runtime.dispose();
	await rm(directory, {
		recursive: true,
		force: true,
	});
});

const schemaFile = async (name: string, text: string) => {
	const path = join(directory, `${name}.zed`);
	await writeFile(path, text);
	return path;
};

const statusOf = (schemaPathOverride?: string) =>
	runtime.runPromise(
		runConvergeStatus({
			schemaPathOverride,
		}),
	);

const upTo = (schemaPathOverride?: string) =>
	runtime.runPromise(
		runConvergeUp({
			schemaPathOverride,
		}),
	);

const reversedDefinitions = (text: string) =>
	text
		.trim()
		.split(/\n\s*\n(?=definition |caveat )/)
		.reverse()
		.join("\n\n");

describe("converge", () => {
	test("status matches after up", async () => {
		expect(await statusOf()).toBe(true);
	});

	test("up writes nothing when only the definition order differs", async () => {
		const path = await schemaFile("reordered", reversedDefinitions(schema));

		expect(await statusOf(path)).toBe(true);
		expect(await upTo(path)).toBe(false);
	});

	// An unused definition leaves every permission the parallel tier files check intact.
	test("up writes a real change once, then matches", async () => {
		const path = await schemaFile(
			"added",
			`${schema}\ndefinition converge_probe {}\n`,
		);

		try {
			expect(await upTo(path)).toBe(true);
			expect(await statusOf(path)).toBe(true);
			expect(await upTo(path)).toBe(false);
		} finally {
			await upTo();
		}
		expect(await statusOf()).toBe(true);
	});

	test.each([
		[
			"a changed permission",
			(text: string) =>
				text.replace(
					"permission manage_providers = admin",
					"permission manage_providers = admin + manager",
				),
		],
		[
			"an added relation",
			(text: string) =>
				text.replace(
					"relation bot: bot\n",
					"relation bot: bot\n\trelation guest: user\n",
				),
		],
		[
			"an added definition",
			(text: string) => `${text}\ndefinition extra {}\n`,
		],
		[
			"a removed definition",
			(text: string) => text.replace(/definition chat \{[^}]*\}/, ""),
		],
		[
			"an added caveat",
			(text: string) => `${text}\ncaveat on_weekday(day int) {\n\tday < 6\n}\n`,
		],
	])("status does not match with %s", async (name, change) => {
		const changed = change(schema);
		expect(changed).not.toBe(schema);
		const path = await schemaFile(name.replaceAll(" ", "-"), changed);

		expect(await statusOf(path)).toBe(false);
	});
});
