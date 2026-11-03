import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ToolSet, UIMessage } from "ai";
import { Client } from "pg";
import { closeInvalidToolParts } from "@/lib/ai/utils/close-invalid-tool-parts";
import { toolSummary } from "../../registry";
import type { AssistantToolDeps } from "../procedure-tool";
import { findPeopleTool } from "../sharing/find-people";
import { findBotsTool } from "./find-bots";

const MIGRATION = new URL(
	"../../../../../../../../packages/db/migrations/20261103080517_easy_tony_stark/migration.sql",
	import.meta.url,
);

const statements = readFileSync(MIGRATION, "utf8").split(
	"--> statement-breakpoint",
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

/** Runs the parts rewrite and answers how many rows its update changed. */
const migrate = async (client: Client) => {
	let updated = 0;
	for (const statement of statements) {
		const result = await client.query(statement);
		if (/^\s*UPDATE/.test(statement)) {
			updated = result.rowCount ?? 0;
		}
	}
	return updated;
};

const botId = "00000000-0000-4000-8000-000000000001";

const fixtures = {
	listed: [
		{
			type: "text",
			text: "I called findBots with a limit.",
		},
		{
			type: "tool-findBots",
			toolCallId: "call-bots",
			state: "output-available",
			input: {
				query: "Quiz",
				limit: 30,
			},
			output: {
				bots: [],
				total: 0,
			},
		},
		{
			type: "tool-findPeople",
			toolCallId: "call-people",
			state: "output-available",
			input: {
				targetType: "bot",
				targetId: botId,
				limit: 20,
			},
			output: {
				grantees: [],
				count: 3,
			},
		},
	],
	untouched: [
		{
			type: "text",
			text: '{"type":"tool-findBots","limit":30}',
		},
		{
			type: "tool-listAccess",
			toolCallId: "call-access",
			state: "output-available",
			input: {
				targetType: "bot",
				targetId: botId,
			},
			output: {
				count: 2,
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
			SELECT 'List paging', new_user.id, new_organization.id FROM new_user, new_organization
			RETURNING id`,
			[
				`list-paging-${suffix}`,
				`list-paging-${suffix}@example.test`,
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
	findBots: findBotsTool({} as AssistantToolDeps),
	findPeople: findPeopleTool({} as AssistantToolDeps),
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

describe("list paging migration", () => {
	test("rewrites only the row with list calls, and a second run changes nothing", () => {
		expect(result.first).toBe(1);
		expect(result.again).toBe(0);
	});

	test("list calls lose their limit and findPeople counts in total, prose untouched", () => {
		expect<unknown>(result.parts.listed).toEqual([
			fixtures.listed[0],
			{
				...fixtures.listed[1],
				input: {
					query: "Quiz",
				},
			},
			{
				...fixtures.listed[2],
				input: {
					targetType: "bot",
					targetId: botId,
				},
				output: {
					grantees: [],
					total: 3,
				},
			},
		]);
	});

	test("other tools and prose stay as they were", () => {
		expect<unknown>(result.parts.untouched).toEqual(fixtures.untouched);
	});

	test("a continued chat keeps the rewritten calls typed, the stored ones would not be", async () => {
		expect(
			(await replayed(result.parts.listed)).map((part) => part.type),
		).toEqual([
			"text",
			"tool-findBots",
			"tool-findPeople",
		]);
		expect((await replayed(fixtures.listed)).map((part) => part.type)).toEqual([
			"text",
			"dynamic-tool",
			"dynamic-tool",
		]);
	});

	test("the work log reads findPeople's total", () => {
		const part = result.parts.listed[2] as {
			input: unknown;
			output: unknown;
		};
		expect(
			toolSummary("findPeople", {
				input: part.input,
				output: part.output,
			})?.line((ref) => ref.id),
		).toContain("3");
	});
});
