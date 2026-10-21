import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const BACKFILL = new URL(
	"../migrations/20261021161501_dear_baron_strucker/migration.sql",
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

describe("pipeline status backfill", () => {
	test("links follow their asset's processing, and failed ones get a kind", async () => {
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
					`Backfill ${suffix}`,
					`backfill-${suffix}@example.test`,
				],
			);
			const {
				rows: [block],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO block (type, name, config, user_id)
				 VALUES ('database', 'Backfill', '{}', $1) RETURNING id`,
				[
					user.id,
				],
			);
			const assetIds: Record<string, string> = {};
			for (const status of [
				"pending",
				"active",
				"completed",
				"failed",
			]) {
				const {
					rows: [asset],
				} = await client.query<{
					id: string;
				}>(
					`INSERT INTO asset (bucket, prefix, title, size, file_type, processing_status, user_id)
					 VALUES ('uploads', 'backfill', $1::text, 1, 'pdf', $1::pipeline_status, $2) RETURNING id`,
					[
						status,
						user.id,
					],
				);
				assetIds[status] = asset.id;
				await client.query(
					"INSERT INTO block_asset (block_id, asset_id) VALUES ($1, $2)",
					[
						block.id,
						asset.id,
					],
				);
			}

			for (const statement of readFileSync(BACKFILL, "utf8").split(
				"--> statement-breakpoint",
			)) {
				await client.query(statement);
			}

			const { rows } = await client.query<{
				title: string;
				processing_failure: string | null;
				index_status: string;
				index_failure: string | null;
			}>(
				`SELECT a.title, a.processing_failure, l.index_status, l.index_failure
				 FROM block_asset l JOIN asset a ON a.id = l.asset_id
				 WHERE l.block_id = $1 ORDER BY a.title`,
				[
					block.id,
				],
			);
			expect(rows).toEqual([
				{
					title: "active",
					processing_failure: null,
					index_status: "pending",
					index_failure: null,
				},
				{
					title: "completed",
					processing_failure: null,
					index_status: "completed",
					index_failure: null,
				},
				{
					title: "failed",
					processing_failure: "other",
					index_status: "failed",
					index_failure: "other",
				},
				{
					title: "pending",
					processing_failure: null,
					index_status: "pending",
					index_failure: null,
				},
			]);
		} finally {
			await client.query("ROLLBACK");
			await client.end();
		}
	});
});
