import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ToolSet, UIMessage } from "ai";
import { Client } from "pg";
import { closeInvalidToolParts } from "@/lib/ai/utils/close-invalid-tool-parts";
import { m } from "@/paraglide/messages";
import { updateAssetTool } from "./assistant/bots/update-asset";
import { findCatalogueTool } from "./assistant/catalogue/find-catalogue";
import { findBlocksTool } from "./assistant/core/find-blocks";
import type { AssistantToolDeps } from "./assistant/procedure-tool";
import { listModelOutput } from "./rag/outputs";
import { toolSummary } from "./registry";

const MIGRATION = new URL(
	"../../../../../../packages/db/migrations/20261101140457_thick_moondragon/migration.sql",
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

/** Runs the migration and answers how many rows each update changed. */
const migrate = async (client: Client) => {
	const updated: number[] = [];
	for (const statement of statements) {
		const result = await client.query(statement);
		if (/^\s*UPDATE/.test(statement)) {
			updated.push(result.rowCount ?? 0);
		}
	}
	return updated;
};

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const blocks = {
	behaviour: {
		type: "template",
		config: {
			systemPrompt: "Answer in APA 7.",
		},
	},
	repository: {
		type: "database",
		config: {
			minReferences: 1,
			maxReferences: 8,
			defaultReferences: 4,
			retrievalMode: "hybrid",
		},
	},
	partial: {
		type: "database",
		config: {
			minReferences: 2,
			maxReferences: 6,
		},
	},
	mixed: {
		type: "database",
		config: {
			minReferences: 2,
			minPassages: 3,
			defaultReferences: null,
		},
	},
	migrated: {
		type: "repository",
		config: {
			minPassages: 1,
			maxPassages: 8,
			defaultPassages: 4,
		},
	},
};

const assets = {
	labelled: {
		appliedFields: [
			"title",
			"citation",
			"author",
		],
		metadata: {
			author: "Ada Lovelace",
			citation: "Lovelace (1843)",
		},
		suggestion: {
			title: "Notes",
			metadata: {
				citation: "Lovelace, A. (1843). Notes.",
				language: "en",
			},
		},
	},
	mixed: {
		appliedFields: [
			"citation",
			"citationLabel",
		],
		metadata: {
			citation: "Old",
			citationLabel: "New",
		},
		suggestion: null,
	},
	migrated: {
		appliedFields: [
			"citationLabel",
		],
		metadata: {
			citationLabel: "Babbage (1864)",
		},
		suggestion: {
			metadata: {
				citationLabel: "Babbage, C. (1864).",
			},
		},
	},
};

const call = (
	tool: string,
	input: unknown,
	output: unknown,
	toolCallId = `call-${tool}`,
) => ({
	type: `tool-${tool}`,
	toolCallId,
	state: "output-available",
	input,
	output,
});

const fixtures = {
	blocks: [
		{
			type: "text",
			text: "Looking for a template.",
		},
		call(
			"findBlocks",
			{
				type: "template",
				query: "APA",
				limit: 30,
			},
			{
				blocks: [],
				total: 0,
			},
		),
		call(
			"findCatalogue",
			{
				query: "APA",
				kind: "template",
				limit: 30,
			},
			{
				entries: [
					{
						entry: {
							targetType: "block",
							targetId: id(1),
						},
						kind: "template",
						name: "Strict",
					},
					{
						entry: {
							targetType: "bot",
							targetId: id(2),
						},
						kind: "bot",
						name: "Tutor",
					},
				],
				total: 2,
			},
		),
		call(
			"getBlock",
			{
				id: id(1),
			},
			{
				type: "template",
				id: id(1),
				name: "Strict",
				systemPrompt: "Answer as a template would.",
			},
		),
		call(
			"getBot",
			{
				id: id(2),
			},
			{
				type: "bot",
				id: id(2),
				name: "Tutor",
				behaviour: {
					type: "template",
					id: id(1),
					name: "Strict",
				},
				repositories: [],
			},
		),
		call(
			"createBehaviour",
			{
				name: "Strict",
				systemPrompt: "Use type template.",
			},
			{
				type: "template",
				id: id(1),
				name: "Strict",
				status: "draft",
			},
		),
		call(
			"deleteBlock",
			{
				ids: [
					id(1),
					id(3),
				],
			},
			{
				deleted: [
					{
						type: "template",
						id: id(1),
						name: "Strict",
					},
				],
				skipped: [
					{
						type: "repository",
						id: id(3),
						name: "Sources",
					},
				],
			},
		),
	],
	assets: [
		call(
			"listRepositoryAssets",
			{},
			{
				assets: [
					{
						assetId: id(4),
						title: "Notes",
						citation: "Lovelace (1843)",
						state: "ready",
					},
					{
						assetId: id(5),
						title: "Sketch",
						state: "ready",
					},
				],
			},
		),
		call(
			"getAssetPage",
			{
				page: 3,
			},
			{
				passages: [],
				matchedAssets: [
					{
						assetId: id(4),
						title: "Notes",
						citation: "Lovelace (1843)",
						state: "ready",
					},
				],
			},
		),
		call(
			"updateAsset",
			{
				id: id(4),
				metadata: {
					citation: "Lovelace (1843)",
				},
			},
			{
				type: "asset",
				id: id(4),
				title: "Notes",
				metadata: {
					author: "Ada Lovelace",
					citation: "Lovelace (1843)",
				},
			},
		),
	],
	untouched: [
		{
			type: "text",
			text: '{"type":"tool-getBlock","citation":"x","kind":"template","output":{"type":"database"}}',
		},
		call(
			"createRepository",
			{
				name: "Sources",
			},
			{
				type: "repository",
				id: id(3),
				name: "Sources",
				status: "draft",
				assetCount: 0,
			},
		),
		call(
			"findAssets",
			{
				query: "template",
			},
			{
				assets: [],
				total: 0,
			},
		),
	],
};

type Fixture = keyof typeof fixtures;
type Part = UIMessage["parts"][number];

const rowsByName = <
	Row extends {
		name: string;
	},
>(
	rows: Row[],
) =>
	Object.fromEntries(
		rows.map((row) => [
			row.name,
			row,
		]),
	);

/** Inserts the fixtures, migrates twice, and answers the rows as they end up. */
const migrated = async () => {
	const client = await connect();
	try {
		await client.query("BEGIN");
		const suffix = crypto.randomUUID();
		const {
			rows: [owner],
		} = await client.query<{
			userId: string;
			chatId: string;
			organizationId: string;
		}>(
			`WITH new_user AS (
				INSERT INTO "user" (name, email, email_verified, created_at, updated_at)
				VALUES ($1, $2, true, now(), now()) RETURNING id
			), new_organization AS (
				INSERT INTO organization (name, slug, created_at)
				VALUES ($1, $1, now()) RETURNING id
			)
			INSERT INTO chat (title, user_id, organization_id)
			SELECT 'Block renames', new_user.id, new_organization.id FROM new_user, new_organization
			RETURNING user_id AS "userId", id AS "chatId", organization_id AS "organizationId"`,
			[
				`block-renames-${suffix}`,
				`block-renames-${suffix}@example.test`,
			],
		);
		for (const [name, block] of Object.entries(blocks)) {
			await client.query(
				"INSERT INTO block (type, name, config, user_id) VALUES ($1, $2, $3::json, $4)",
				[
					block.type,
					name,
					JSON.stringify(block.config),
					owner.userId,
				],
			);
		}
		const {
			rows: [run],
		} = await client.query<{
			id: string;
		}>(
			`INSERT INTO activity_run (user_id, kind, organization_id)
			 VALUES ($1, 'fill_metadata', $2) RETURNING id`,
			[
				owner.userId,
				owner.organizationId,
			],
		);
		for (const [name, asset] of Object.entries(assets)) {
			await client.query(
				`WITH new_asset AS (
					INSERT INTO asset (bucket, prefix, title, metadata, metadata_suggestion, size, file_type, user_id)
					VALUES ('uploads', 'block-renames', $1, $2::json, $3::json, 1, 'pdf', $4) RETURNING id
				)
				INSERT INTO activity_member (run_id, asset_id, metadata_state, applied_fields)
				SELECT $5, new_asset.id, 'completed', $6 FROM new_asset`,
				[
					name,
					JSON.stringify(asset.metadata),
					asset.suggestion && JSON.stringify(asset.suggestion),
					owner.userId,
					run.id,
					asset.appliedFields,
				],
			);
		}
		for (const [position, [fixture, parts]] of Object.entries(
			fixtures,
		).entries()) {
			await client.query(
				`INSERT INTO chat_message (chat_id, role, parts, attachments, metadata, position)
				 VALUES ($1, 'assistant', $2::json, '[]', $3::json, $4)`,
				[
					owner.chatId,
					JSON.stringify(parts),
					JSON.stringify({
						fixture,
					}),
					position,
				],
			);
		}

		const locations = async () => {
			const { rows } = await client.query<{
				name: string;
				ctid: string;
			}>(
				`SELECT 'block:' || name AS name, ctid::text FROM block WHERE user_id = $1
				 UNION ALL SELECT 'asset:' || title, ctid::text FROM asset WHERE user_id = $1
				 UNION ALL SELECT 'activity:' || asset.title, member.ctid::text FROM activity_member member
					JOIN asset ON asset.id = member.asset_id WHERE asset.user_id = $1
				 UNION ALL SELECT 'message:' || (metadata->>'fixture'), ctid::text FROM chat_message WHERE chat_id = $2`,
				[
					owner.userId,
					owner.chatId,
				],
			);
			return Object.fromEntries(
				rows.map((row) => [
					row.name,
					row.ctid,
				]),
			);
		};

		const before = await locations();
		const first = await migrate(client);
		const after = await locations();
		const again = await migrate(client);

		const { rows: blockRows } = await client.query<{
			name: string;
			type: string;
			config: object;
		}>("SELECT name, type, config FROM block WHERE user_id = $1", [
			owner.userId,
		]);
		const { rows: assetRows } = await client.query<{
			name: string;
			metadata: object;
			suggestion: object | null;
			appliedFields: string[];
		}>(
			`SELECT asset.title AS name, asset.metadata, asset.metadata_suggestion AS suggestion, member.applied_fields AS "appliedFields"
			 FROM asset JOIN activity_member member ON member.asset_id = asset.id WHERE asset.user_id = $1`,
			[
				owner.userId,
			],
		);
		const { rows: messageRows } = await client.query<{
			name: Fixture;
			parts: Part[];
		}>(
			`SELECT metadata->>'fixture' AS name, parts FROM chat_message WHERE chat_id = $1`,
			[
				owner.chatId,
			],
		);

		return {
			first,
			again,
			written: Object.keys(before).filter((key) => before[key] !== after[key]),
			blocks: rowsByName(blockRows),
			assets: rowsByName(assetRows),
			parts: Object.fromEntries(
				messageRows.map((row) => [
					row.name,
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

const partOf = (parts: Part[], type: string) => {
	const part = parts.find((candidate) => candidate.type === type) as
		| {
				input: unknown;
				output: unknown;
		  }
		| undefined;
	if (!part) throw new Error(`No ${type}`);
	return part;
};

const tools: ToolSet = {
	findBlocks: findBlocksTool({} as AssistantToolDeps),
	findCatalogue: findCatalogueTool({} as AssistantToolDeps),
	updateAsset: updateAssetTool({} as AssistantToolDeps),
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
	return message.parts.map((part) => part.type);
};

describe("behaviours and repositories migration", () => {
	test("writes only rows in an old shape, and a second run changes nothing", () => {
		expect(result.written.sort()).toEqual([
			"activity:labelled",
			"activity:mixed",
			"asset:labelled",
			"asset:mixed",
			"block:behaviour",
			"block:mixed",
			"block:partial",
			"block:repository",
			"message:assets",
			"message:blocks",
		]);
		expect(result.again.every((count) => count === 0)).toBe(true);
	});

	test("blocks get the new types and passage keys, an existing new key wins, no null is written", () => {
		expect(result.blocks.behaviour).toMatchObject({
			type: "behaviour",
			config: blocks.behaviour.config,
		});
		expect(result.blocks.repository).toMatchObject({
			type: "repository",
			config: {
				minPassages: 1,
				maxPassages: 8,
				defaultPassages: 4,
				retrievalMode: "hybrid",
			},
		});
		expect(result.blocks.partial.config).toEqual({
			minPassages: 2,
			maxPassages: 6,
		});
		expect(result.blocks.mixed.config).toEqual({
			minPassages: 3,
		});
		expect(result.blocks.migrated).toMatchObject(blocks.migrated);
	});

	test("asset metadata and suggestions name the citation label citationLabel", () => {
		expect(result.assets.labelled).toMatchObject({
			metadata: {
				author: "Ada Lovelace",
				citationLabel: "Lovelace (1843)",
			},
			suggestion: {
				title: "Notes",
				metadata: {
					citationLabel: "Lovelace, A. (1843). Notes.",
					language: "en",
				},
			},
		});
		expect(result.assets.labelled.metadata).not.toHaveProperty("citation");
		expect(result.assets.mixed.metadata).toEqual({
			citationLabel: "New",
		});
		expect(result.assets.migrated).toMatchObject(assets.migrated);
	});

	test("activities name a filled citation label citationLabel, in order, once", () => {
		expect(result.assets.labelled.appliedFields).toEqual([
			"title",
			"citationLabel",
			"author",
		]);
		expect(result.assets.mixed.appliedFields).toEqual([
			"citationLabel",
		]);
		expect(result.assets.migrated.appliedFields).toEqual([
			"citationLabel",
		]);
	});

	test("block tool parts get the new block types in inputs and outputs, in order, prose untouched", () => {
		const parts = result.parts.blocks as unknown[];
		expect(parts[0]).toEqual(fixtures.blocks[0]);
		expect<string[]>(parts.map((part) => (part as Part).type)).toEqual(
			fixtures.blocks.map((part) => part.type),
		);
		expect(partOf(result.parts.blocks, "tool-findBlocks").input).toEqual({
			type: "behaviour",
			query: "APA",
			limit: 30,
		});
		expect(partOf(result.parts.blocks, "tool-findCatalogue")).toMatchObject({
			input: {
				kind: "behaviour",
			},
			output: {
				entries: [
					{
						kind: "behaviour",
						name: "Strict",
					},
					{
						kind: "bot",
						name: "Tutor",
					},
				],
			},
		});
		expect(partOf(result.parts.blocks, "tool-getBlock").output).toEqual({
			type: "behaviour",
			id: id(1),
			name: "Strict",
			systemPrompt: "Answer as a template would.",
		});
		expect(partOf(result.parts.blocks, "tool-getBot").output).toMatchObject({
			type: "bot",
			behaviour: {
				type: "behaviour",
			},
		});
		expect(partOf(result.parts.blocks, "tool-createBehaviour")).toMatchObject({
			input: {
				systemPrompt: "Use type template.",
			},
			output: {
				type: "behaviour",
			},
		});
		expect(partOf(result.parts.blocks, "tool-deleteBlock").output).toEqual({
			deleted: [
				{
					type: "behaviour",
					id: id(1),
					name: "Strict",
				},
			],
			skipped: [
				{
					type: "repository",
					id: id(3),
					name: "Sources",
				},
			],
		});
	});

	test("asset tool parts name the citation label citationLabel", () => {
		const [listed] = (
			partOf(result.parts.assets, "tool-listRepositoryAssets").output as {
				assets: object[];
			}
		).assets;
		expect(listed).toEqual({
			assetId: id(4),
			title: "Notes",
			citationLabel: "Lovelace (1843)",
			state: "ready",
		});
		expect(
			partOf(result.parts.assets, "tool-getAssetPage").output,
		).toMatchObject({
			matchedAssets: [
				{
					citationLabel: "Lovelace (1843)",
				},
			],
		});
		expect(partOf(result.parts.assets, "tool-updateAsset")).toMatchObject({
			input: {
				metadata: {
					citationLabel: "Lovelace (1843)",
				},
			},
			output: {
				metadata: {
					author: "Ada Lovelace",
					citationLabel: "Lovelace (1843)",
				},
			},
		});
	});

	test("other tools and prose keep their values", () => {
		expect<unknown>(result.parts.untouched).toEqual(fixtures.untouched);
	});

	test("a continued chat keeps the rewritten calls typed, the stored ones would not be", async () => {
		expect<string[]>(await replayed(result.parts.blocks)).toEqual(
			fixtures.blocks.map((part) => part.type),
		);
		expect<string[]>(await replayed(result.parts.assets)).toEqual(
			fixtures.assets.map((part) => part.type),
		);
		expect(await replayed(fixtures.blocks)).toContain("dynamic-tool");
		expect(await replayed(fixtures.assets)).toContain("dynamic-tool");
	});

	test("the model reads the citation label of a rewritten asset list", () => {
		const { output } = partOf(result.parts.assets, "tool-listRepositoryAssets");
		expect(
			listModelOutput({
				output,
			}),
		).toMatchObject({
			value: expect.stringContaining("Notes (Lovelace (1843))"),
		});
	});

	test("the work log reads the rewritten calls as behaviours", () => {
		const line = (type: string, fixture: Part[]) => {
			const { input, output } = partOf(fixture, `tool-${type}`);
			return toolSummary(type, {
				input,
				output,
			})?.line((ref) => ref.id);
		};
		const name = m.assistant_tool_quoted_name({
			name: "Strict",
		});
		expect(line("getBlock", result.parts.blocks)).toBe(
			m.assistant_tool_get_block_summary_behaviour({
				name,
			}),
		);
		expect(line("getBlock", fixtures.blocks as Part[])).toBe(
			m.assistant_tool_get_block_summary_repository({
				name,
			}),
		);
		expect(line("findBlocks", result.parts.blocks)).toBe(
			m.assistant_tool_find_blocks_summary_behaviours_query({
				count: 0,
				query: m.assistant_tool_quoted_name({
					name: "APA",
				}),
			}),
		);
	});
});
