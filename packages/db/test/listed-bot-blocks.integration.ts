import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const MIGRATION = new URL(
	"../migrations/20261029044745_tan_victor_mancha/migration.sql",
	import.meta.url,
);

const connect = async () => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});
	await client.connect();
	return client;
};

describe("listed bots with unlisted blocks", () => {
	test("become unlisted with their public tuple; other bots keep their listing", async () => {
		const client = await connect();
		const insertId = async (statement: string, values: unknown[]) =>
			(
				await client.query<{
					id: string;
				}>(statement, values)
			).rows[0].id;
		try {
			await client.query("BEGIN");
			const userId = await insertId(
				`INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
				 VALUES ('Author', $1, true, now(), now()) RETURNING id`,
				[
					`author-${crypto.randomUUID()}@example.test`,
				],
			);
			const setVisibility = (
				resourceType: "bot" | "block",
				resourceId: string,
				visibility: "public" | "private",
			) =>
				client.query(
					`INSERT INTO resource_visibility (resource_type, resource_id, visibility, updated_by)
					 VALUES ($1, $2, $3, $4)`,
					[
						resourceType,
						resourceId,
						visibility,
						userId,
					],
				);
			const block = async (visibility: "public" | "private") => {
				const id = await insertId(
					`INSERT INTO block (type, name, config, user_id)
					 VALUES ('template', 'Behaviour', '{}', $1) RETURNING id`,
					[
						userId,
					],
				);
				await setVisibility("block", id, visibility);
				return id;
			};
			const bot = async (blockIds: string[]) => {
				const id = await insertId(
					`INSERT INTO bot (name, description, content_html, user_id)
					 VALUES ('Bot', '', '', $1) RETURNING id`,
					[
						userId,
					],
				);
				await setVisibility("bot", id, "public");
				for (const blockId of blockIds)
					await client.query(
						"INSERT INTO bot_block (bot_id, block_id) VALUES ($1, $2)",
						[
							id,
							blockId,
						],
					);
				return id;
			};
			const exposing = await bot([
				await block("public"),
				await block("private"),
			]);
			const consistent = await bot([
				await block("public"),
			]);

			for (const statement of readFileSync(MIGRATION, "utf8").split(
				"--> statement-breakpoint",
			)) {
				if (statement.trim()) await client.query(statement);
			}

			const { rows: visibility } = await client.query<{
				resource_id: string;
				visibility: string;
			}>(
				`SELECT resource_id, visibility FROM resource_visibility
				 WHERE resource_type = 'bot' AND resource_id = ANY($1::uuid[])`,
				[
					[
						exposing,
						consistent,
					],
				],
			);
			expect(
				Object.fromEntries(
					visibility.map((row) => [
						row.resource_id,
						row.visibility,
					]),
				),
			).toEqual({
				[exposing]: "private",
				[consistent]: "public",
			});

			const { rows: outbox } = await client.query<{
				payload_json: {
					mutations: {
						resourceId: string;
						relation: string;
						subjectId: string;
						operation: string;
					}[];
				};
			}>(
				`SELECT payload_json FROM authz_outbox
				 WHERE status = 'pending' AND payload_json::text LIKE '%' || $1 || '%'`,
				[
					exposing,
				],
			);
			expect(
				outbox
					.flatMap((row) => row.payload_json.mutations)
					.filter((mutation) => mutation.resourceId === exposing),
			).toEqual([
				expect.objectContaining({
					resourceType: "bot",
					relation: "public",
					subjectType: "user",
					subjectId: "*",
					operation: "delete",
				}),
			]);
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
			await client.end();
		}
	});
});
