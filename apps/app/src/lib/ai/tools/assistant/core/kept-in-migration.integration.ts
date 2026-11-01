import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ToolSet, UIMessage } from "ai";
import { Client } from "pg";
import { closeInvalidToolParts } from "@/lib/ai/utils/close-invalid-tool-parts";
import { toolSummary } from "../../registry";
import type { AssistantToolDeps } from "../procedure-tool";
import { findAssetsTool } from "./find-assets";

const MIGRATION = new URL(
	"../../../../../../../../packages/db/migrations/20261101123559_productive_zuras/migration.sql",
	import.meta.url,
);

// The column and enum renames already ran on the test database; the parts rewrite runs again.
const statements = readFileSync(MIGRATION, "utf8")
	.split("--> statement-breakpoint")
	.filter((statement) => !statement.trim().startsWith("ALTER"));

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

/** Runs the parts rewrite and answers how many rows its update changed. */
const migrate = async (client: Client) => {
	let updated = 0;
	for (const statement of statements) {
		const result = await client.query(statement);
		if (statement.trim().startsWith("UPDATE")) {
			updated = result.rowCount ?? 0;
		}
	}
	return updated;
};

const assetId = "00000000-0000-4000-8000-000000000001";

const found = (input: unknown, output: unknown, toolCallId: string) => ({
	type: "tool-findAssets",
	toolCallId,
	state: "output-available",
	input,
	output,
});

const fixtures = {
	listed: [
		{
			type: "text",
			text: "I called findAssets with origin library.",
		},
		found(
			{
				query: "APA",
				origin: "library",
				limit: 30,
			},
			{
				assets: [
					{
						id: assetId,
						title: "APA guide",
						processingStatus: "completed",
						origin: "chat",
						canEdit: true,
					},
				],
				total: 1,
			},
			"call-listed",
		),
		found(
			{
				limit: 30,
			},
			{
				assets: [],
				total: 0,
			},
			"call-empty",
		),
	],
	untouched: [
		{
			type: "text",
			text: '{"type":"tool-findAssets","origin":"library"}',
		},
		{
			type: "tool-findBlocks",
			toolCallId: "call-blocks",
			state: "output-available",
			input: {
				origin: "library",
			},
			output: {
				origin: "library",
			},
		},
	],
};

type Fixture = keyof typeof fixtures;
type Part = UIMessage["parts"][number];

/** Inserts the fixtures in one chat, migrates twice, and answers each row's parts. */
const migrated = async () => {
	const client = await connect();
	try {
		await client.query("BEGIN");
		const suffix = crypto.randomUUID();
		const {
			rows: [chat],
		} = await client.query<{
			id: string;
		}>(
			`WITH new_user AS (
				INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
				VALUES ($1, $2, true, now(), now()) RETURNING id
			), new_organization AS (
				INSERT INTO organization (name, slug, created_at)
				VALUES ($1, $1, now()) RETURNING id
			)
			INSERT INTO chat (title, user_id, organization_id)
			SELECT 'Kept in', new_user.id, new_organization.id FROM new_user, new_organization
			RETURNING id`,
			[
				`kept-in-${suffix}`,
				`kept-in-${suffix}@example.test`,
			],
		);
		const ids = new Map<string, Fixture>();
		for (const [position, [fixture, parts]] of Object.entries(
			fixtures,
		).entries()) {
			const {
				rows: [row],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO chat_message (chat_id, role, parts, attachments, metadata, position)
				 VALUES ($1, 'assistant', $2::json, '[]', '{}', $3) RETURNING id`,
				[
					chat.id,
					JSON.stringify(parts),
					position,
				],
			);
			ids.set(row.id, fixture as Fixture);
		}

		const first = await migrate(client);
		const again = await migrate(client);

		const { rows } = await client.query<{
			id: string;
			parts: Part[];
		}>("SELECT id, parts FROM chat_message WHERE chat_id = $1", [
			chat.id,
		]);

		return {
			first,
			again,
			parts: Object.fromEntries(
				rows.map((row) => [
					ids.get(row.id),
					row.parts,
				]),
			) as Record<Fixture, Part[]>,
		};
	} finally {
		await client.query("ROLLBACK");
		await client.end();
	}
};

const result = await migrated();

const tools: ToolSet = {
	findAssets: findAssetsTool({} as AssistantToolDeps),
};

/** The stored parts as the next turn hands them to the model. */
const replayed = async (parts: unknown[]) => {
	const [message] = await closeInvalidToolParts(
		[
			{
				id: "reply",
				role: "assistant",
				parts: parts as Part[],
			},
		],
		tools,
	);
	return message.parts;
};

describe("kept in migration", () => {
	test("rewrites only the findAssets row, and a second run changes nothing", () => {
		expect(result.first).toBe(1);
		expect(result.again).toBe(0);
	});

	test("findAssets parts name keptIn in the input and each asset, in order, prose untouched", () => {
		expect<unknown>(result.parts.listed).toEqual([
			fixtures.listed[0],
			{
				...fixtures.listed[1],
				input: {
					query: "APA",
					keptIn: "library",
					limit: 30,
				},
				output: {
					assets: [
						{
							id: assetId,
							title: "APA guide",
							processingStatus: "completed",
							keptIn: "chat",
							canEdit: true,
						},
					],
					total: 1,
				},
			},
			fixtures.listed[2],
		]);
	});

	test("other tools and prose keep origin", () => {
		expect<unknown>(result.parts.untouched).toEqual(fixtures.untouched);
	});

	test("a continued chat keeps the rewritten call typed, the stored one would not be", async () => {
		expect(
			(await replayed(result.parts.listed)).map((part) => part.type),
		).toEqual([
			"text",
			"tool-findAssets",
			"tool-findAssets",
		]);
		expect((await replayed(fixtures.listed)).map((part) => part.type)).toEqual([
			"text",
			"dynamic-tool",
			"tool-findAssets",
		]);
	});

	test("the work log reads the rewritten call", () => {
		const part = result.parts.listed[1] as {
			input: unknown;
			output: unknown;
		};
		expect(
			toolSummary("findAssets", {
				input: part.input,
				output: part.output,
			})?.line((ref) => ref.id),
		).toContain("APA");
	});
});
