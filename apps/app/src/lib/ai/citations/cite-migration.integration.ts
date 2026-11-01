import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const MIGRATION = new URL(
	"../../../../../../packages/db/migrations/20261101051938_watery_luke_cage/migration.sql",
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

/** Runs the migration and answers how many rows its update changed. */
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

const text = (content: string) => ({
	type: "text",
	text: content,
	state: "done",
	providerMetadata: {
		anthropic: {
			signature: '<cite chunk="k000009">kept</cite>',
		},
	},
});

const matrixInput = (note: string) => ({
	title: "Check",
	rows: [
		{
			label: "Hattie",
			cells: [
				[
					{
						status: "not_met",
						note,
					},
				],
			],
		},
	],
});

interface Row {
	role: "user" | "assistant";
	parts: unknown[];
	metadata?: unknown;
	/** Stored as written, so a row the migration rewrites loses this spacing. */
	raw?: string;
}

const rows = {
	mixed: {
		role: "assistant",
		parts: [
			{
				type: "step-start",
			},
			text(
				'A <cite ref=kgol9ts>a</cite> B <cite ref="kgol9ts">b</cite> C <cite chunk="k000001">c</cite> D <cite assetId="9b2d4c6e" title="Refund policy" page="4">d</cite> E <cite  page = \'2\'  title="Q">e</cite>.',
			),
		],
		metadata: {
			model: "m",
			citations: {
				k000001: {
					assetId: "asset-a",
					title: "Refund policy",
					page: 4,
				},
				kgol9ts: {
					kind: "asset",
					assetId: "asset-b",
					title: "Travel policy",
				},
			},
		},
	},
	aliases: {
		role: "assistant",
		parts: [
			text(
				[
					'<cite data-x="1" chunk="k000002" page="3">a</cite>',
					'<cite   chunk = "k000003"  >b</cite>',
					"<cite chunk='k000004'>c</cite>",
					"<cite chunk=k000005>d</cite>",
					'<cite chunk="k7f3a2">e</cite>',
					'<cite assetid="x">f</cite>',
					'<cite asset_id="x">g</cite>',
					'<cite pageNumber="2">h</cite>',
					'<cite page_number="2">i</cite>',
					'`<cite chunk="k000006">code</cite>`',
				].join(" "),
			),
		],
	},
	quoted: {
		role: "assistant",
		parts: [
			text(
				[
					"<cite title='chunk=\"k000001\"'>a</cite>",
					'<cite title="a>b" page="2">b</cite>',
					'<cite data-title="T" chunk="k000002">c</cite>',
				].join(" "),
			),
		],
	},
	unclosed: {
		role: "assistant",
		parts: [
			text(
				'Start <cite title="T" page="1">never closed. <cite chunk="k000007">ok</cite> end <cite title="T">open',
			),
		],
	},
	others: {
		role: "assistant",
		parts: [
			text(
				'<cite>plain</cite> <cite ref="kgol9ts" page="4">x</cite> <cite class="q">quote</cite> <citex chunk="k000001">y</citex> <cite ref=kgol9ts>z</cite> <cite ref=kgol9ts data-chunk="k000001">w</cite>',
			),
		],
	},
	display: {
		role: "assistant",
		parts: [
			text("Lead-in"),
			{
				type: "tool-showMatrix",
				toolCallId: "call-1",
				state: "output-available",
				input: matrixInput(
					'He said "use an ampersand" <cite chunk="k000008">here</cite>.',
				),
				output: {
					shown: true,
					note: '<cite title="T" page="2">old</cite>',
				},
			},
			{
				type: "tool-searchRepositories",
				toolCallId: "call-2",
				state: "output-available",
				input: {
					query: '<cite chunk="k000001">',
				},
				output: {
					results: [
						{
							ref: "k000001",
							text: 'Passage text with <cite chunk="k000001">a tag</cite>.',
						},
					],
				},
			},
			text("Conclusion"),
		],
	},
	question: {
		role: "user",
		parts: [
			text('A question with <cite chunk="k000001">a tag</cite>.'),
		],
	},
	untouched: {
		role: "assistant",
		parts: [],
		raw: '[{"type": "text",   "text": "No citations here."}]',
		metadata: {
			citations: {},
		},
	},
	metadataOnly: {
		role: "assistant",
		parts: [],
		raw: '[{"type": "text",   "text": "Paid <cite ref=kgol9ts>soon</cite>."}]',
		metadata: {
			citations: {
				kgol9ts: {
					assetId: "asset-a",
					title: "Refund policy",
				},
			},
		},
	},
} satisfies Record<string, Row>;

type Fixture = keyof typeof rows;

interface Stored {
	parts: unknown[];
	metadata: Record<string, unknown>;
	rawParts: string;
	rawMetadata: string;
}

/** Inserts the rows in one chat, migrates twice, and answers each row after each run. */
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
			SELECT 'Citations', new_user.id, new_organization.id FROM new_user, new_organization
			RETURNING id`,
			[
				`cite-refs-${suffix}`,
				`cite-refs-${suffix}@example.test`,
			],
		);
		const ids = new Map<string, Fixture>();
		for (const [position, [fixture, row]] of Object.entries(rows).entries()) {
			const {
				rows: [inserted],
			} = await client.query<{
				id: string;
			}>(
				`INSERT INTO chat_message (chat_id, role, parts, attachments, metadata, position)
				 VALUES ($1, $2, $3::json, '[]', $4::json, $5) RETURNING id`,
				[
					chat.id,
					row.role,
					"raw" in row ? row.raw : JSON.stringify(row.parts),
					JSON.stringify("metadata" in row ? row.metadata : {}),
					position,
				],
			);
			ids.set(inserted.id, fixture as Fixture);
		}

		const read = async () => {
			const { rows: stored } = await client.query<{
				id: string;
				parts: unknown[];
				metadata: Record<string, unknown>;
				raw_parts: string;
				raw_metadata: string;
			}>(
				`SELECT id, parts, metadata, parts::text AS raw_parts, metadata::text AS raw_metadata
				 FROM chat_message WHERE chat_id = $1`,
				[
					chat.id,
				],
			);
			return Object.fromEntries(
				stored.map((row) => [
					ids.get(row.id),
					{
						parts: row.parts,
						metadata: row.metadata,
						rawParts: row.raw_parts,
						rawMetadata: row.raw_metadata,
					},
				]),
			) as Record<Fixture, Stored>;
		};

		const before = await read();
		await migrate(client);
		const first = await read();
		const again = await migrate(client);
		const second = await read();

		return {
			before,
			first,
			again,
			second,
		};
	} finally {
		await client.query("ROLLBACK");
		await client.end();
	}
};

const result = await migrated();

const textOf = (fixture: Fixture, index = 0) =>
	(
		result.first[fixture].parts.filter(
			(part) =>
				(
					part as {
						type: string;
					}
				).type === "text",
		)[index] as {
			text: string;
		}
	).text;

describe("cite migration", () => {
	test("rewrites chunk cites to unquoted refs and strips older cites to their text", () => {
		expect(textOf("mixed")).toBe(
			'A <cite ref=kgol9ts>a</cite> B <cite ref="kgol9ts">b</cite> C <cite ref=k000001>c</cite> D d E e.',
		);
	});

	test("reads attribute aliases, spacing, quotes and code spans", () => {
		expect(textOf("aliases")).toBe(
			[
				"<cite ref=k000002>a</cite>",
				"<cite ref=k000003>b</cite>",
				"<cite ref=k000004>c</cite>",
				"<cite ref=k000005>d</cite>",
				'<cite ref="k7f3a2">e</cite>',
				"f",
				"g",
				"h",
				"i",
				"`<cite ref=k000006>code</cite>`",
			].join(" "),
		);
	});

	test("reads whole attributes, not names inside values or longer names", () => {
		expect(textOf("quoted")).toBe("a b <cite ref=k000002>c</cite>");
	});

	test("removes an older opening tag that never closes", () => {
		expect(textOf("unclosed")).toBe(
			"Start never closed. <cite ref=k000007>ok</cite> end open",
		);
	});

	test("leaves every other cite shape as it is", () => {
		expect(result.first.others.rawParts).toBe(result.before.others.rawParts);
	});

	test("rewrites display calls at any depth, in order, and nothing else", () => {
		const [lead, matrix, search, conclusion] = rows.display.parts;

		expect(result.first.display.parts).toEqual([
			lead,
			{
				...matrix,
				input: matrixInput(
					'He said "use an ampersand" <cite ref=k000008>here</cite>.',
				),
				output: {
					shown: true,
					note: "old",
				},
			},
			search,
			conclusion,
		]);
	});

	test("keeps the provider metadata of text parts and user messages as they are", () => {
		expect(
			(
				result.first.mixed.parts[1] as {
					providerMetadata: unknown;
				}
			).providerMetadata,
		).toEqual(text("").providerMetadata);
		expect(result.first.question.rawParts).toBe(
			result.before.question.rawParts,
		);
	});

	test("gives stored citations without a kind the asset kind", () => {
		expect(result.first.mixed.metadata).toEqual({
			model: "m",
			citations: {
				k000001: {
					kind: "asset",
					assetId: "asset-a",
					title: "Refund policy",
					page: 4,
				},
				kgol9ts: {
					kind: "asset",
					assetId: "asset-b",
					title: "Travel policy",
				},
			},
		});
		expect(result.first.metadataOnly.metadata).toEqual({
			citations: {
				kgol9ts: {
					kind: "asset",
					assetId: "asset-a",
					title: "Refund policy",
				},
			},
		});
	});

	test("writes no row without an older form, and no parts that did not change", () => {
		expect(result.first.untouched).toEqual(result.before.untouched);
		expect(result.first.metadataOnly.rawParts).toBe(
			result.before.metadataOnly.rawParts,
		);
	});

	test("a second run changes no row and leaves the first run's output as it is", () => {
		expect(result.again).toBe(0);
		expect(result.second).toEqual(result.first);
	});
});
