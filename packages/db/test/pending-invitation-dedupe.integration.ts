import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const MIGRATION = new URL(
	"../migrations/20261103013350_ambitious_champions/migration.sql",
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

const DAY_MS = 86_400_000;

describe("duplicate pending invitations", () => {
	test("keep the longest-lived one with its email; the others close and their undelivered emails go", async () => {
		const client = await connect();
		try {
			await client.query("BEGIN");
			await client.query('DROP INDEX "invitation_org_pending_email_unique"');
			const suffix = crypto.randomUUID();
			const {
				rows: [organization],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO organization (name, slug, created_at)
				 VALUES ('Duplicates', $1, now()) RETURNING id`,
				[
					`duplicates-${suffix}`,
				],
			);
			const email = `twice-${suffix}@example.test`;
			const invite = async (
				address: string,
				expiresInDays: number,
				outbox: {
					status: "pending" | "processing" | "sent";
					leaseExpiresAt?: Date;
				} = {
					status: "pending",
				},
			) => {
				const {
					rows: [{ id }],
				} = await client.query<{
					id: string;
				}>(
					`INSERT INTO invitation (organization_id, email, role, status, expires_at)
					 VALUES ($1, $2, 'member', 'pending', $3) RETURNING id`,
					[
						organization.id,
						address,
						new Date(Date.now() + expiresInDays * DAY_MS),
					],
				);
				await client.query(
					`INSERT INTO notification_outbox (type, recipient, payload, deduplication_key, status, lease_expires_at)
					 VALUES ('organization.invited', $1, '{}', $2, $3, $4)`,
					[
						address,
						`organization.invited:${id}`,
						outbox.status,
						outbox.leaseExpiresAt ?? null,
					],
				);
				return id;
			};
			const shorter = await invite(email, 3);
			const longest = await invite(` ${email.toUpperCase()}`, 7);
			const expired = await invite(email, -1);
			// Claimed by a worker that crashed, so its lease has run out.
			const claimed = await invite(email, 1, {
				status: "processing",
				leaseExpiresAt: new Date(Date.now() - 60_000),
			});
			const delivered = await invite(email, 2, {
				status: "sent",
			});
			const other = await invite(`other-${suffix}@example.test`, 1);

			for (const statement of readFileSync(MIGRATION, "utf8").split(
				"--> statement-breakpoint",
			)) {
				if (statement.trim()) await client.query(statement);
			}

			const { rows: invitations } = await client.query<{
				id: string;
				status: string;
			}>("SELECT id, status FROM invitation WHERE organization_id = $1", [
				organization.id,
			]);
			expect(
				Object.fromEntries(
					invitations.map((row) => [
						row.id,
						row.status,
					]),
				),
			).toEqual({
				[shorter]: "rejected",
				[longest]: "pending",
				[expired]: "rejected",
				[claimed]: "rejected",
				[delivered]: "rejected",
				[other]: "pending",
			});
			const { rows: emails } = await client.query<{
				deduplication_key: string;
			}>(
				"SELECT deduplication_key FROM notification_outbox WHERE deduplication_key = ANY($1)",
				[
					[
						shorter,
						longest,
						expired,
						claimed,
						delivered,
						other,
					].map((id) => `organization.invited:${id}`),
				],
			);
			expect(emails.map((row) => row.deduplication_key).sort()).toEqual(
				[
					`organization.invited:${longest}`,
					`organization.invited:${delivered}`,
					`organization.invited:${other}`,
				].sort(),
			);
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
			await client.end();
		}
	});
});
