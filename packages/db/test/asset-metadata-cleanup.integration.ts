import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const MIGRATION = new URL(
	"../migrations/20261028133422_famous_warlock/migration.sql",
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

describe("asset metadata flag removal", () => {
	test("assets lose the citation and relevance flags and keep every other key", async () => {
		const client = await connect();
		try {
			await client.query("BEGIN");
			const suffix = crypto.randomUUID();
			const {
				rows: [user],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
				 VALUES ($1, $2, true, now(), now()) RETURNING id`,
				[
					`Metadata ${suffix}`,
					`metadata-${suffix}@example.test`,
				],
			);
			const metadataBefore: Record<string, object> = {
				flagged: {
					showReference: false,
					relevance: "high",
					author: "Ada Lovelace",
					citation: "Lovelace 1843",
				},
				clean: {
					author: "Charles Babbage",
				},
			};
			for (const [title, metadata] of Object.entries(metadataBefore)) {
				await client.query(
					`INSERT INTO asset (bucket, prefix, title, metadata, size, file_type, user_id)
					 VALUES ('uploads', 'metadata-cleanup', $1, $2::json, 1, 'pdf', $3)`,
					[
						title,
						JSON.stringify(metadata),
						user.id,
					],
				);
			}

			for (const statement of readFileSync(MIGRATION, "utf8").split(
				"--> statement-breakpoint",
			)) {
				await client.query(statement);
			}

			const { rows } = await client.query<{
				title: string;
				metadata: object;
			}>(
				"SELECT title, metadata FROM asset WHERE user_id = $1 ORDER BY title",
				[
					user.id,
				],
			);
			expect(rows).toEqual([
				{
					title: "clean",
					metadata: {
						author: "Charles Babbage",
					},
				},
				{
					title: "flagged",
					metadata: {
						author: "Ada Lovelace",
						citation: "Lovelace 1843",
					},
				},
			]);
		} finally {
			await client.query("ROLLBACK");
			await client.end();
		}
	});
});
