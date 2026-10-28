import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const BACKFILL = new URL(
	"../migrations/20261028210428_goofy_hellfire_club/migration.sql",
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

describe("chat organisation backfill", () => {
	test("each chat family takes its root's first signal, and chats without one go", async () => {
		const client = await connect();
		const insertId = async (statement: string, values: unknown[]) =>
			(
				await client.query<{
					id: string;
				}>(statement, values)
			).rows[0].id;
		try {
			await client.query("BEGIN");
			// The chats predate the column's NOT NULL, as on a database before the migration.
			await client.query(
				`ALTER TABLE "chat" ALTER COLUMN "organization_id" DROP NOT NULL`,
			);
			const suffix = crypto.randomUUID();
			const user = (name: string) =>
				insertId(
					`INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
					 VALUES ($1, $2, true, now(), now()) RETURNING id`,
					[
						name,
						`${name}-${suffix}@example.test`,
					],
				);
			const organization = (name: string) =>
				insertId(
					`INSERT INTO organization (name, slug, created_at)
					 VALUES ($1, $2, now()) RETURNING id`,
					[
						name,
						`${name}-${suffix}`,
					],
				);
			const join = (userId: string, organizationId: string, at: string) =>
				client.query(
					`INSERT INTO member (organization_id, user_id, role, created_at)
					 VALUES ($1, $2, 'member', $3)`,
					[
						organizationId,
						userId,
						at,
					],
				);
			const provider = (organizationId: string) =>
				insertId(
					`INSERT INTO provider (organization_id, name, kind, description, api_key_encrypted)
					 VALUES ($1, 'Backfill', 'openai-compatible', '', 'x') RETURNING id`,
					[
						organizationId,
					],
				);
			const model = (providerId: string) =>
				insertId(
					`INSERT INTO model (provider_id, provider_model_id, name, description, capability)
					 VALUES ($1, 'backfill', 'Backfill', '', '{}') RETURNING id`,
					[
						providerId,
					],
				);
			const chat = (
				userId: string,
				config: object | null,
				{
					parentChatId = null,
					kind = "chat",
					organizationId = null,
				}: {
					parentChatId?: string | null;
					kind?: "chat" | "assistant";
					organizationId?: string | null;
				} = {},
			) =>
				insertId(
					`INSERT INTO chat (user_id, config, parent_chat_id, kind, organization_id)
					 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
					[
						userId,
						config === null ? null : JSON.stringify(config),
						parentChatId,
						kind,
						organizationId,
					],
				);

			const [owner, tied, leaver] = [
				await user("owner"),
				await user("tied"),
				await user("leaver"),
			];
			const [earliest, later, providerHome, modelHome, assistantHome] = [
				await organization("earliest"),
				await organization("later"),
				await organization("provider-home"),
				await organization("model-home"),
				await organization("assistant-home"),
			];
			await join(owner, later, "2026-02-01");
			await join(owner, earliest, "2026-01-01");
			// Two memberships at once fall back to the smaller organisation id.
			await join(tied, earliest, "2026-01-01");
			await join(tied, later, "2026-01-01");
			const providerId = await provider(providerHome);
			const modelId = await model(await provider(modelHome));
			const deletedProviderId = await provider(providerHome);
			await client.query("DELETE FROM provider WHERE id = $1", [
				deletedProviderId,
			]);

			const chats = {
				empty: await chat(owner, {}),
				nullConfig: await chat(owner, null),
				missingProvider: await chat(owner, {
					providerId: crypto.randomUUID(),
				}),
				deletedProvider: await chat(owner, {
					providerId: deletedProviderId,
				}),
				malformedProvider: await chat(owner, {
					providerId: "not-a-uuid",
				}),
				provider: await chat(owner, {
					providerId,
					modelId,
				}),
				modelOnly: await chat(owner, {
					modelId,
				}),
				tie: await chat(tied, {}),
				assistant: await chat(
					owner,
					{},
					{
						kind: "assistant",
						organizationId: assistantHome,
					},
				),
				homeless: await chat(leaver, {}),
				leaverWithProvider: await chat(leaver, {
					providerId,
				}),
			};
			const branch = await chat(
				owner,
				{
					modelId,
				},
				{
					parentChatId: chats.provider,
				},
			);
			const twig = await chat(
				owner,
				{},
				{
					parentChatId: branch,
				},
			);

			for (const statement of readFileSync(BACKFILL, "utf8").split(
				"--> statement-breakpoint",
			)) {
				if (statement.trim()) await client.query(statement);
			}

			const { rows } = await client.query<{
				id: string;
				organization_id: string;
			}>("SELECT id, organization_id FROM chat WHERE id = ANY($1::uuid[])", [
				[
					...Object.values(chats),
					branch,
					twig,
				],
			]);
			const organizationOf = Object.fromEntries(
				rows.map((row) => [
					row.id,
					row.organization_id,
				]),
			);

			expect(organizationOf[chats.empty]).toBe(earliest);
			expect(organizationOf[chats.nullConfig]).toBe(earliest);
			expect(organizationOf[chats.missingProvider]).toBe(earliest);
			expect(organizationOf[chats.deletedProvider]).toBe(earliest);
			expect(organizationOf[chats.malformedProvider]).toBe(earliest);
			expect(organizationOf[chats.provider]).toBe(providerHome);
			expect(organizationOf[chats.modelOnly]).toBe(modelHome);
			expect(organizationOf[chats.tie]).toBe(
				[
					earliest,
					later,
				].sort()[0],
			);
			expect(organizationOf[chats.assistant]).toBe(assistantHome);
			expect(organizationOf[branch]).toBe(providerHome);
			expect(organizationOf[twig]).toBe(providerHome);
			// A former member keeps a chat with a signal, read-only, and loses one without.
			expect(organizationOf[chats.leaverWithProvider]).toBe(providerHome);
			expect(chats.homeless in organizationOf).toBe(false);
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
			await client.end();
		}
	});
});
