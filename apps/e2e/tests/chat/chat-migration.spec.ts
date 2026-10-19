import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { expect, test } from "../../fixtures/index";

/**
 * No public API produces branch trees any more, so this spec seeds legacy rows
 * directly into a throwaway database and runs the flattening migrations on it.
 */
const FLATTENING = [
	"20261019103029_familiar_electro",
	"20261019103037_overjoyed_thunderball",
	"20261019103044_colossal_kinsey_walden",
];

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

const text = (value: string) => [
	{
		type: "text",
		text: value,
	},
];

const database = `e2e_chat_migration_${randomUUID().replaceAll("-", "")}`;
let admin: Client;
let db: Client;

const ids = {
	user: randomUUID(),
	bot: randomUUID(),
	block: randomUUID(),
	chat: randomUUID(),
	fallbackChat: randomUUID(),
	activeBranch: randomUUID(),
	sideBranch: randomUUID(),
	twigBranch: randomUUID(),
	staleBranch: randomUUID(),
	freshBranch: randomUUID(),
};

/**
 * The main chat's tree; `twig` forks off the side branch, so `u2b` is shared
 * by two non-active branches, and `orphan` is reached by no branch.
 *
 *   r ─ a1 ┬ u2 ─ a2 ─ u3     active
 *          ├ u2b ┬ a2b       side
 *          │     └ a2c       twig
 *          └ orphan
 */
const tree = {
	r: randomUUID(),
	a1: randomUUID(),
	u2: randomUUID(),
	a2: randomUUID(),
	u3: randomUUID(),
	u2b: randomUUID(),
	a2b: randomUUID(),
	a2c: randomUUID(),
	orphan: randomUUID(),
	fr: randomUUID(),
	fStale: randomUUID(),
	fFresh: randomUUID(),
};

const seed = async () => {
	await db.query(
		`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
		 VALUES ($1, 'Migration User', $2, true, now(), now())`,
		[
			ids.user,
			`${ids.user}@example.test`,
		],
	);
	await db.query(
		`INSERT INTO bot (id, name, description, content_html, user_id) VALUES ($1, 'Bot', '', '', $2)`,
		[
			ids.bot,
			ids.user,
		],
	);
	await db.query(
		`INSERT INTO block (id, type, name, config, user_id) VALUES ($1, 'text', 'Block', '{}', $2)`,
		[
			ids.block,
			ids.user,
		],
	);
	await db.query(
		`INSERT INTO chat (id, title, user_id, bot_id, config, created_at, updated_at) VALUES
		 ($1, 'Tree chat', $3, $4, '{"temperature":0.3}', '2026-01-01', '2026-01-09'),
		 ($2, 'Fallback chat', $3, NULL, '{}', '2026-01-01', '2026-01-09')`,
		[
			ids.chat,
			ids.fallbackChat,
			ids.user,
			ids.bot,
		],
	);
	await db.query(
		`INSERT INTO chat_block (block_id, chat_id, created_at) VALUES ($1, $2, '2026-01-02')`,
		[
			ids.block,
			ids.chat,
		],
	);

	// Depths are deliberately wrong: the migration must not trust them.
	const messages: [
		string,
		string,
		string,
		string | null,
		string,
	][] = [
		[
			tree.r,
			ids.chat,
			"user",
			null,
			"root",
		],
		[
			tree.a1,
			ids.chat,
			"assistant",
			tree.r,
			"first answer",
		],
		[
			tree.u2,
			ids.chat,
			"user",
			tree.a1,
			"active question",
		],
		[
			tree.a2,
			ids.chat,
			"assistant",
			tree.u2,
			"active answer",
		],
		[
			tree.u3,
			ids.chat,
			"user",
			tree.a2,
			"active follow-up",
		],
		[
			tree.u2b,
			ids.chat,
			"user",
			tree.a1,
			"side question",
		],
		[
			tree.a2b,
			ids.chat,
			"assistant",
			tree.u2b,
			"side answer",
		],
		[
			tree.a2c,
			ids.chat,
			"assistant",
			tree.u2b,
			"twig answer",
		],
		[
			tree.orphan,
			ids.chat,
			"user",
			tree.a1,
			"orphan",
		],
		[
			tree.fr,
			ids.fallbackChat,
			"user",
			null,
			"fallback root",
		],
		[
			tree.fStale,
			ids.fallbackChat,
			"assistant",
			tree.fr,
			"stale answer",
		],
		[
			tree.fFresh,
			ids.fallbackChat,
			"assistant",
			tree.fr,
			"fresh answer",
		],
	];
	for (const [index, [id, chatId, role, parent, body]] of messages.entries()) {
		await db.query(
			`INSERT INTO chat_message (id, chat_id, role, parts, attachments, metadata, parent_message_id, depth, created_at)
			 VALUES ($1, $2, $3, $4, '[]', '{}', $5, 7, timestamp '2026-01-01' + make_interval(mins => $6))`,
			[
				id,
				chatId,
				role,
				JSON.stringify(text(body)),
				parent,
				index,
			],
		);
	}

	await db.query(
		`INSERT INTO chat_branch (id, chat_id, leaf_message_id, name, created_at, updated_at) VALUES
		 ($1, $6, $7, 'Main', '2026-01-01', '2026-01-02'),
		 ($2, $6, $8, 'Side', '2026-01-03', '2026-01-04'),
		 ($3, $6, $9, 'Twig', '2026-01-05', '2026-01-06'),
		 ($4, $10, $11, 'Stale', '2026-01-01', '2026-01-02'),
		 ($5, $10, $12, 'Fresh', '2026-01-01', '2026-01-03')`,
		[
			ids.activeBranch,
			ids.sideBranch,
			ids.twigBranch,
			ids.staleBranch,
			ids.freshBranch,
			ids.chat,
			tree.u3,
			tree.a2b,
			tree.a2c,
			ids.fallbackChat,
			tree.fStale,
			tree.fFresh,
		],
	);
	await db.query("UPDATE chat SET active_branch_id = $1 WHERE id = $2", [
		ids.activeBranch,
		ids.chat,
	]);
};

type MessageRow = {
	id: string;
	role: string;
	parts: ReturnType<typeof text>;
	position: number;
};

const messagesOf = async (chatId: string) =>
	(
		await db.query<MessageRow>(
			"SELECT id, role, parts, position FROM chat_message WHERE chat_id = $1 ORDER BY position",
			[
				chatId,
			],
		)
	).rows;

const chatHolding = async (messageId: string) =>
	(
		await db.query<{
			id: string;
			title: string;
			user_id: string;
			bot_id: string | null;
			config: unknown;
			parent_chat_id: string | null;
			branched_from_message_id: string | null;
			created_at: string;
			updated_at: string;
		}>(
			`SELECT c.id, c.title, c.user_id, c.bot_id, c.config, c.parent_chat_id, c.branched_from_message_id,
			 c.created_at::text AS created_at, c.updated_at::text AS updated_at
			 FROM chat c JOIN chat_message m ON m.chat_id = c.id WHERE m.id = $1`,
			[
				messageId,
			],
		)
	).rows[0];

const bodies = (rows: MessageRow[]) => rows.map((row) => row.parts[0]?.text);

test.describe.configure({
	mode: "serial",
});

test.beforeAll(async () => {
	admin = await connect(process.env.POSTGRES_DB as string);
	await admin.query(`CREATE DATABASE "${database}"`);
	db = await connect(database);

	const folders = readdirSync(migrationsDir)
		.filter((folder) =>
			existsSync(join(migrationsDir, folder, "migration.sql")),
		)
		.sort();
	const start = folders.indexOf(FLATTENING[0] as string);
	expect(folders.slice(start, start + FLATTENING.length)).toEqual(FLATTENING);

	for (const folder of folders.slice(0, start)) await apply(db, folder);
	await seed();
	for (const folder of FLATTENING) await apply(db, folder);
});

test.afterAll(async () => {
	await db?.end();
	await admin?.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
	await admin?.end();
});

test("the active branch keeps the chat and becomes its ordered messages", async () => {
	const rows = await messagesOf(ids.chat);
	expect(rows.map((row) => row.id)).toEqual([
		tree.r,
		tree.a1,
		tree.u2,
		tree.a2,
		tree.u3,
	]);
	expect(rows.map((row) => row.position)).toEqual([
		0,
		1,
		2,
		3,
		4,
	]);

	const chat = await chatHolding(tree.r);
	expect(chat?.id).toBe(ids.chat);
	expect(chat?.parent_chat_id).toBeNull();
	expect(chat?.branched_from_message_id).toBeNull();
});

test("another branch becomes a linked chat with its own copy of shared messages", async () => {
	const side = await chatHolding(tree.a2b);
	expect(side).toMatchObject({
		title: "Tree chat",
		user_id: ids.user,
		bot_id: ids.bot,
		config: {
			temperature: 0.3,
		},
		parent_chat_id: ids.chat,
		branched_from_message_id: tree.a1,
		created_at: "2026-01-03 00:00:00",
		updated_at: "2026-01-04 00:00:00",
	});
	expect(side?.id).not.toBe(ids.chat);

	const rows = await messagesOf(side?.id as string);
	expect(bodies(rows)).toEqual([
		"root",
		"first answer",
		"side question",
		"side answer",
	]);
	expect(rows.map((row) => row.position)).toEqual([
		0,
		1,
		2,
		3,
	]);
	// Shared with the active path or the twig: copied. Exclusive: moved.
	for (const original of [
		tree.r,
		tree.a1,
		tree.u2b,
	]) {
		expect(rows.map((row) => row.id)).not.toContain(original);
	}
	expect(rows[3]?.id).toBe(tree.a2b);

	const blocks = await db.query(
		"SELECT block_id FROM chat_block WHERE chat_id = $1",
		[
			side?.id,
		],
	);
	expect(blocks.rows).toEqual([
		{
			block_id: ids.block,
		},
	]);
});

test("a branch off a branch forks from the deepest message on the active path", async () => {
	const twig = await chatHolding(tree.a2c);
	expect(twig?.parent_chat_id).toBe(ids.chat);
	expect(twig?.branched_from_message_id).toBe(tree.a1);
	expect(bodies(await messagesOf(twig?.id as string))).toEqual([
		"root",
		"first answer",
		"side question",
		"twig answer",
	]);
});

test("messages no branch reaches are deleted", async () => {
	const gone = await db.query(
		"SELECT id FROM chat_message WHERE id = ANY($1)",
		[
			[
				tree.orphan,
				tree.u2b,
			],
		],
	);
	expect(gone.rows).toEqual([]);
});

test("without an active branch the most recently updated one keeps the chat", async () => {
	expect(bodies(await messagesOf(ids.fallbackChat))).toEqual([
		"fallback root",
		"fresh answer",
	]);
	const stale = await chatHolding(tree.fStale);
	expect(stale?.parent_chat_id).toBe(ids.fallbackChat);
	expect(stale?.branched_from_message_id).toBe(tree.fr);
	expect(stale?.bot_id).toBeNull();
});

test("each new chat queues its owner and bot relationships", async () => {
	const side = await chatHolding(tree.a2b);
	const stale = await chatHolding(tree.fStale);
	const events = await db.query<{
		event_type: string;
		status: string;
		payload_json: {
			mutations: unknown[];
		};
	}>(
		"SELECT event_type, status, payload_json FROM authz_outbox WHERE payload_json::text LIKE $1",
		[
			`%${side?.id}%`,
		],
	);
	expect(events.rows).toEqual([
		{
			event_type: "spice.write-relationships",
			status: "pending",
			payload_json: {
				mutations: [
					{
						resourceType: "chat",
						resourceId: side?.id,
						relation: "owner",
						subjectType: "user",
						subjectId: ids.user,
						operation: "touch",
					},
					{
						resourceType: "chat",
						resourceId: side?.id,
						relation: "bot",
						subjectType: "bot",
						subjectId: ids.bot,
						operation: "touch",
					},
				],
			},
		},
	]);

	const staleEvent = await db.query(
		"SELECT payload_json FROM authz_outbox WHERE payload_json::text LIKE $1",
		[
			`%${stale?.id}%`,
		],
	);
	expect(staleEvent.rows[0]?.payload_json.mutations).toEqual([
		{
			resourceType: "chat",
			resourceId: stale?.id,
			relation: "owner",
			subjectType: "user",
			subjectId: ids.user,
			operation: "touch",
		},
	]);

	const total = await db.query("SELECT count(*)::int AS n FROM authz_outbox");
	expect(total.rows[0]?.n).toBe(3);
});

test("the tree columns and the branch table are gone", async () => {
	const columns = await db.query(
		`SELECT table_name, column_name, is_nullable FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name IN ('chat', 'chat_message')
		 AND column_name IN ('active_branch_id', 'parent_message_id', 'depth', 'position')`,
	);
	expect(columns.rows).toEqual([
		{
			table_name: "chat_message",
			column_name: "position",
			is_nullable: "NO",
		},
	]);

	const branchTable = await db.query(
		"SELECT to_regclass('public.chat_branch') AS name",
	);
	expect(branchTable.rows[0]?.name).toBeNull();

	await expect(
		db.query(
			`INSERT INTO chat_message (chat_id, role, parts, attachments, metadata, position)
			 VALUES ($1, 'user', '[]', '[]', '{}', 0)`,
			[
				ids.chat,
			],
		),
	).rejects.toThrow(/chat_message_chat_position_unique/);
});
