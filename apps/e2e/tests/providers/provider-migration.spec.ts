import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { expect, test } from "../../fixtures/index";

/**
 * No public API writes the old `compatibility` column any more, so this spec
 * seeds a provider into a throwaway database and runs the kind migration on it.
 */
const KIND_MIGRATION = "20261020142811_certain_ink";

const migrationsDir = (() => {
	for (
		let dir = import.meta.dirname;
		dir !== dirname(dir);
		dir = dirname(dir)
	) {
		const candidate = join(dir, "packages/db/migrations");
		if (existsSync(candidate)) return candidate;
	}
	throw new Error("packages/db/migrations not found above this spec");
})();

const connect = async (database: string) => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database,
	});
	await client.connect();
	return client;
};

const apply = async (db: Client, folder: string) => {
	const sql = readFileSync(
		join(migrationsDir, folder, "migration.sql"),
		"utf8",
	);
	await db.query("BEGIN");
	try {
		for (const statement of sql.split("--> statement-breakpoint")) {
			if (statement.trim()) await db.query(statement);
		}
		await db.query("COMMIT");
	} catch (error) {
		await db.query("ROLLBACK");
		throw new Error(`${folder} failed`, {
			cause: error,
		});
	}
};

const database = `e2e_provider_migration_${randomUUID().replaceAll("-", "")}`;
const ids = {
	organization: randomUUID(),
	provider: randomUUID(),
};
let admin: Client;
let db: Client;

test.beforeAll(async () => {
	admin = await connect(process.env.POSTGRES_DB as string);
	await admin.query(`CREATE DATABASE "${database}"`);
	db = await connect(database);

	const folders = readdirSync(migrationsDir)
		.filter((folder) =>
			existsSync(join(migrationsDir, folder, "migration.sql")),
		)
		.sort();
	const start = folders.indexOf(KIND_MIGRATION);
	expect(start).toBeGreaterThan(0);

	for (const folder of folders.slice(0, start)) await apply(db, folder);
	await db.query(
		`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, 'Migration Org', $2, now())`,
		[
			ids.organization,
			`migration-${ids.organization}`,
		],
	);
	await db.query(
		`INSERT INTO provider (id, organization_id, name, compatibility, description, endpoint, api_key_encrypted)
		 VALUES ($1, $2, 'Legacy', 'openai', '', 'https://llm.example.org/v1', 'encrypted')`,
		[
			ids.provider,
			ids.organization,
		],
	);
	await apply(db, KIND_MIGRATION);
});

test.afterAll(async () => {
	await db?.end();
	await admin?.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
	await admin?.end();
});

test("providers: an existing OpenAI provider becomes OpenAI-compatible with its endpoint", async () => {
	const { rows } = await db.query(
		"SELECT kind, endpoint FROM provider WHERE id = $1",
		[
			ids.provider,
		],
	);

	expect(rows).toEqual([
		{
			kind: "openai-compatible",
			endpoint: "https://llm.example.org/v1",
		},
	]);
});

test("providers: the endpoint column accepts null", async () => {
	const { rows } = await db.query(
		`SELECT is_nullable FROM information_schema.columns
		 WHERE table_name = 'provider' AND column_name = 'endpoint'`,
	);

	expect(rows).toEqual([
		{
			is_nullable: "YES",
		},
	]);
});
