import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const migration = (name: string) =>
	readFileSync(
		new URL(`../migrations/${name}/migration.sql`, import.meta.url),
		"utf8",
	).split("--> statement-breakpoint");

const MIGRATION = migration("20261101035249_sloppy_the_enforcers");
const KEPT_IN = migration("20261101123559_productive_zuras");

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

describe("chat uploads held by repositories", () => {
	test("join the Library, others stay chat uploads, a second run changes nothing, and the kept_in rename keeps them", async () => {
		const client = await connect();
		try {
			await client.query("BEGIN");
			// The schema this migration ran on, before kept_in.
			await client.query(
				"ALTER TABLE asset RENAME COLUMN kept_in TO origin; ALTER TYPE asset_kept_in RENAME TO asset_origin",
			);
			const suffix = crypto.randomUUID();
			const {
				rows: [user],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
				 VALUES ($1, $2, true, now(), now()) RETURNING id`,
				[
					`Uploads ${suffix}`,
					`uploads-${suffix}@example.test`,
				],
			);
			const {
				rows: [block],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO block (type, name, config, user_id)
				 VALUES ('database', 'Repository', '{}', $1) RETURNING id`,
				[
					user.id,
				],
			);
			const asset = async (title: string, origin: string) => {
				const {
					rows: [row],
				} = await client.query<{
					id: string;
				}>(
					`INSERT INTO asset (bucket, prefix, title, size, file_type, origin, user_id)
					 VALUES ('uploads', 'chat-uploads', $1, 1, 'pdf', $2, $3) RETURNING id`,
					[
						title,
						origin,
						user.id,
					],
				);
				return row.id;
			};
			const linked = await asset("linked", "chat");
			await asset("unlinked", "chat");
			const library = await asset("library", "library");
			for (const assetId of [
				linked,
				library,
			])
				await client.query(
					"INSERT INTO block_asset (block_id, asset_id) VALUES ($1, $2)",
					[
						block.id,
						assetId,
					],
				);

			const migrate = async () => {
				for (const statement of MIGRATION) await client.query(statement);
			};
			const state = async () => ({
				assets: (
					await client.query<{
						title: string;
						origin: string;
						user_id: string;
					}>(
						"SELECT title, origin, user_id FROM asset WHERE user_id = $1 ORDER BY title",
						[
							user.id,
						],
					)
				).rows,
				links: (
					await client.query<{
						asset_id: string;
					}>(
						"SELECT asset_id FROM block_asset WHERE block_id = $1 ORDER BY asset_id",
						[
							block.id,
						],
					)
				).rows.map((row) => row.asset_id),
			});

			await migrate();
			const migrated = await state();
			expect(migrated.assets).toEqual([
				{
					title: "library",
					origin: "library",
					user_id: user.id,
				},
				{
					title: "linked",
					origin: "library",
					user_id: user.id,
				},
				{
					title: "unlinked",
					origin: "chat",
					user_id: user.id,
				},
			]);
			expect(migrated.links).toEqual(
				[
					linked,
					library,
				].sort(),
			);

			await migrate();
			expect(await state()).toEqual(migrated);

			for (const statement of KEPT_IN) await client.query(statement);
			const { rows } = await client.query<{
				title: string;
				kept_in: string;
			}>("SELECT title, kept_in FROM asset WHERE user_id = $1 ORDER BY title", [
				user.id,
			]);
			expect(rows).toEqual(
				migrated.assets.map(({ title, origin }) => ({
					title,
					kept_in: origin,
				})),
			);
		} finally {
			await client.query("ROLLBACK");
			await client.end();
		}
	});
});
