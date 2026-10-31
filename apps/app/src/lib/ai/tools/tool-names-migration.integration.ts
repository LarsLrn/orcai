import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { providerCompaction, providerToolLoading } from "@orcai/ai";
import { Client } from "pg";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import type { CapabilitySet } from "./assistant/groups";
import type { NameOf } from "./declaration";
import { listOutputSchema, pageOutputSchema, passagesOf } from "./rag/outputs";
import { toolLabels, toolSummary } from "./registry";

const MIGRATION = new URL(
	"../../../../../../packages/db/migrations/20261031212738_shallow_skullbuster/migration.sql",
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

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const names: Record<string, string> = {
	[id(1)]: "Citation check",
	[id(2)]: "Course readings",
	[id(3)]: "APA guide",
	[id(4)]: "Year 9",
	[id(5)]: "Anna",
	[id(6)]: "Strict",
};
const nameOf: NameOf = (ref) => names[ref.id] ?? ref.id;

const passage = {
	ref: "k000001",
	id: id(7),
	assetId: id(3),
	title: "APA guide",
	blockName: "Course readings",
	pageStart: 4,
	text: "Cite the author and year.",
};

const asset = {
	assetId: id(3),
	title: "APA guide",
	state: "ready" as const,
};

const done = (
	type: string,
	input: unknown,
	output: unknown,
	toolCallId = type,
) => ({
	type,
	toolCallId,
	state: "output-available",
	input,
	output,
});

const fixtures = {
	repository: [
		{
			type: "step-start",
		},
		{
			type: "text",
			text: "I used searchKnowledgeBase and getKnowledgeBaseChunks.",
		},
		done(
			"tool-searchKnowledgeBase",
			{
				query: "citation",
			},
			{
				results: [
					passage,
				],
			},
		),
		done(
			"tool-listKnowledgeBaseDocuments",
			{
				limit: 30,
			},
			{
				documents: [
					asset,
				],
			},
		),
		done(
			"tool-getKnowledgeBasePage",
			{
				page: 9,
				documentTitleQuery: "APA",
				includeAdjacentPages: 0,
				limit: 12,
			},
			{
				passages: [],
				matchedDocuments: [
					asset,
				],
			},
		),
		done(
			"tool-getKnowledgeBaseChunks",
			{
				chunks: [
					"k000001",
				],
				neighbours: 1,
			},
			{
				passages: [
					passage,
				],
			},
		),
	],
	assistant: [
		done(
			"tool-createTemplate",
			{
				name: "Strict",
				systemPrompt: "Answer briefly.",
			},
			{
				type: "template",
				id: id(6),
				name: "Strict",
				status: "draft",
			},
		),
		done(
			"tool-updateTemplate",
			{
				id: id(6),
				status: "ready",
			},
			{
				type: "template",
				id: id(6),
				name: "Strict",
				status: "ready",
			},
		),
		done(
			"tool-installFromCatalogue",
			{
				entry: {
					resourceType: "bot",
					resourceId: id(1),
				},
				withBlocks: true,
			},
			{
				resourceType: "bot",
				resourceId: id(1),
				name: "Citation check",
				from: "Home",
				added: true,
				addedBlocks: [],
			},
		),
		done(
			"tool-uninstallResource",
			{
				entry: {
					resourceType: "block",
					resourceId: id(2),
				},
			},
			{
				resourceType: "block",
				resourceId: id(2),
				name: "Course readings",
				removed: true,
			},
		),
		done(
			"tool-retryAsset",
			{
				assetId: id(3),
				repositoryId: id(2),
			},
			{
				type: "asset",
				id: id(3),
				repositoryId: id(2),
				retried: "indexing",
			},
		),
		done(
			"tool-findPrincipals",
			{
				resourceType: "bot",
				resourceId: id(1),
				principalType: "group",
				query: "year",
				limit: 20,
			},
			{
				principals: [
					{
						principalType: "group",
						principalId: id(4),
						name: "Year 9",
					},
				],
				count: 1,
			},
		),
	],
	unchanged: [
		{
			type: "tool-grantAccess",
			toolCallId: "grant",
			state: "approval-requested",
			input: {
				resourceType: "bot",
				resourceId: id(1),
				principals: [
					{
						principalType: "group",
						principalId: id(4),
					},
				],
				role: "viewer",
			},
			approval: {
				id: "approval-1",
			},
		},
		done(
			"tool-revokeAccess",
			{
				resourceType: "bot",
				resourceId: id(1),
				principalType: "user",
				principalId: id(5),
			},
			{
				resourceType: "bot",
				resourceId: id(1),
				principalType: "user",
				principalId: id(5),
				message: "Revoked.",
			},
		),
		done(
			"tool-listAccess",
			{
				resourceType: "bot",
				resourceId: id(1),
			},
			{
				grants: [
					{
						type: "grant",
						principalType: "user",
						principalId: id(5),
						name: "Anna",
						role: "manager",
					},
				],
				total: 1,
				inherited: {
					through: [
						{
							resourceType: "block",
							resourceId: id(2),
							name: "Course readings",
						},
					],
					hiddenCount: 0,
					groupCount: 0,
					userCount: 1,
					public: false,
				},
			},
		),
		done(
			"tool-createBot",
			{
				name: "Citation check",
				description: "Checks citations.",
				templateId: id(6),
			},
			{
				type: "bot",
				id: id(1),
				name: "Citation check",
				template: {
					type: "template",
					id: id(6),
					name: "Strict",
					status: "ready",
				},
				repositories: [],
			},
		),
		done(
			"tool-getBlock",
			{
				id: id(2),
			},
			{
				type: "repository",
				id: id(2),
				name: "Course readings",
				documents: {
					total: 1,
					ready: 1,
					preparing: 0,
					failed: 0,
				},
				assets: [],
			},
		),
		done(
			"tool-findCatalogue",
			{
				limit: 20,
			},
			{
				entries: [
					{
						entry: {
							resourceType: "block",
							resourceId: id(2),
						},
						kind: "repository",
						name: "Course readings",
						documents: 1,
					},
				],
				total: 1,
			},
		),
	],
	lists: [
		done(
			"tool-loadTools",
			{
				groups: [
					"bots",
				],
			},
			{
				groups: [
					{
						group: "bots",
						loaded: true,
						tools: [
							"findCatalogue",
							"updateTemplate",
							"retryAsset",
						],
						lockedUntilPlanApproved: [
							"createBot",
							"createTemplate",
						],
					},
				],
			},
		),
		done(
			"tool-updatePlan",
			{
				title: "Set up",
				steps: [],
			},
			{
				updated: true,
				unlockedTools: [
					"createBot",
					"createTemplate",
				],
			},
		),
	],
	prose: [
		{
			type: "text",
			text: "Call createTemplate with templateId, then findPrincipals.",
		},
	],
};

type Fixture = keyof typeof fixtures;
type Part = {
	type: string;
	toolCallId?: string;
	input?: unknown;
	output?: unknown;
};

/** Inserts the fixtures in one chat, migrates, and answers each row's parts. */
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
			SELECT 'Tool names', new_user.id, new_organization.id FROM new_user, new_organization
			RETURNING id`,
			[
				`tool-names-${suffix}`,
				`tool-names-${suffix}@example.test`,
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

		await migrate(client);
		const again = await migrate(client);

		const { rows } = await client.query<{
			id: string;
			parts: Part[];
		}>("SELECT id, parts FROM chat_message WHERE chat_id = $1", [
			chat.id,
		]);

		return {
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

const partOf = (fixture: Fixture, type: string) => {
	const part = result.parts[fixture].find(
		(candidate) => candidate.type === type,
	);
	if (!part) throw new Error(`No ${type} in ${fixture}`);
	return part;
};

const lineOf = (part: Part) =>
	toolSummary(part.type.slice("tool-".length), {
		input: part.input,
		output: part.output,
	})?.line(nameOf);

const member: CapabilitySet = {
	read: true,
	create_bot: true,
	create_block: true,
	create_asset: true,
};

describe("tool names migration", () => {
	test("a second run changes no row", () => {
		expect(result.again).toBe(0);
	});

	test("repository tools get their names and keys, in order, prose untouched", () => {
		expect<unknown>(result.parts.repository).toEqual([
			fixtures.repository[0],
			fixtures.repository[1],
			{
				...fixtures.repository[2],
				type: "tool-searchRepositories",
			},
			{
				...fixtures.repository[3],
				type: "tool-listRepositoryAssets",
				output: {
					assets: [
						asset,
					],
				},
			},
			{
				...fixtures.repository[4],
				type: "tool-getAssetPage",
				input: {
					page: 9,
					assetTitleQuery: "APA",
					includeAdjacentPages: 0,
					limit: 12,
				},
				output: {
					passages: [],
					matchedAssets: [
						asset,
					],
				},
			},
			{
				...fixtures.repository[5],
				type: "tool-getPassages",
				input: {
					passages: [
						"k000001",
					],
					neighbours: 1,
				},
			},
		]);
	});

	test("the work log reads the repository outputs", () => {
		expect(
			listOutputSchema.parse(
				partOf("repository", "tool-listRepositoryAssets").output,
			).assets,
		).toEqual([
			asset,
		]);
		expect(
			pageOutputSchema.parse(partOf("repository", "tool-getAssetPage").output)
				.matchedAssets,
		).toEqual([
			asset,
		]);
		expect(
			passagesOf(
				"searchRepositories",
				partOf("repository", "tool-searchRepositories").output,
			),
		).toEqual([
			passage,
		]);
		expect(
			passagesOf(
				"getPassages",
				partOf("repository", "tool-getPassages").output,
			),
		).toEqual([
			passage,
		]);
		for (const part of result.parts.repository.filter(({ type }) =>
			type.startsWith("tool-"),
		)) {
			expect(toolLabels(part).name).not.toBe(part.type.slice("tool-".length));
		}
	});

	test("renamed Assistant tools keep their summary lines", () => {
		expect(
			result.parts.assistant.map((part) => [
				part.type,
				lineOf(part),
			]),
		).toEqual([
			[
				"tool-createBehaviour",
				"Create behaviour “Strict”",
			],
			[
				"tool-updateBehaviour",
				"Update behaviour “Strict”",
			],
			[
				"tool-addFromCatalogue",
				"Add “Citation check” with its behaviour and repositories from the Catalogue",
			],
			[
				"tool-removeFromOrganisation",
				"Remove “Course readings” from the organisation",
			],
			[
				"tool-prepareAssetAgain",
				"Prepare “APA guide” again in “Course readings”",
			],
			[
				"tool-findPeople",
				expect.stringContaining("“Citation check”"),
			],
		]);
		expect(partOf("assistant", "tool-findPeople").output).toEqual({
			grantees: [
				{
					granteeType: "group",
					granteeId: id(4),
					name: "Year 9",
				},
			],
			count: 1,
		});
	});

	test("tools that keep their names get the new keys, a pending approval too", () => {
		const grant = partOf("unchanged", "tool-grantAccess");
		expect(grant).toMatchObject({
			state: "approval-requested",
			approval: {
				id: "approval-1",
			},
			input: {
				targetType: "bot",
				targetId: id(1),
				grantees: [
					{
						granteeType: "group",
						granteeId: id(4),
					},
				],
			},
		});
		expect(lineOf(grant)).toContain("Year 9");
		expect(lineOf(partOf("unchanged", "tool-revokeAccess"))).toContain("Anna");
		expect(partOf("unchanged", "tool-revokeAccess").output).toEqual({
			targetType: "bot",
			targetId: id(1),
			granteeType: "user",
			granteeId: id(5),
			message: "Revoked.",
		});
		expect(partOf("unchanged", "tool-listAccess")).toMatchObject({
			input: {
				targetType: "bot",
				targetId: id(1),
			},
			output: {
				grants: [
					{
						granteeType: "user",
						granteeId: id(5),
					},
				],
				inherited: {
					through: [
						{
							targetType: "block",
							targetId: id(2),
						},
					],
				},
			},
		});
		expect(lineOf(partOf("unchanged", "tool-listAccess"))).toContain(
			"Citation check",
		);
		expect(partOf("unchanged", "tool-createBot")).toMatchObject({
			input: {
				behaviourId: id(6),
			},
			output: {
				behaviour: {
					type: "template",
					id: id(6),
				},
			},
		});
		expect(partOf("unchanged", "tool-getBlock").output).toMatchObject({
			assetTotals: {
				total: 1,
			},
		});
		expect(partOf("unchanged", "tool-findCatalogue").output).toEqual({
			entries: [
				{
					entry: {
						targetType: "block",
						targetId: id(2),
					},
					kind: "repository",
					name: "Course readings",
					assets: 1,
				},
			],
			total: 1,
		});
	});

	test("loaded and unlocked tool lists carry the new names to the model", () => {
		const sessionWith = (
			toolLoading: Parameters<typeof createAssistantSession>[0]["toolLoading"],
		) =>
			createAssistantSession({
				history: [
					{
						parts: result.parts.lists,
					},
				],
				capabilities: member,
				toolLoading,
				compaction: providerCompaction("anthropic", 200_000),
			});
		const plan = partOf("lists", "tool-updatePlan").output as {
			unlockedTools: string[];
		};

		expect(partOf("lists", "tool-loadTools").output).toEqual({
			groups: [
				{
					group: "bots",
					loaded: true,
					tools: [
						"findCatalogue",
						"updateBehaviour",
						"prepareAssetAgain",
					],
					lockedUntilPlanApproved: [
						"createBot",
						"createBehaviour",
					],
				},
			],
		});
		expect(
			sessionWith({
				type: "active-tools",
			}).activeTools(),
		).toEqual(
			expect.arrayContaining([
				"createBehaviour",
				"prepareAssetAgain",
			]),
		);

		const replayed = sessionWith(
			providerToolLoading("anthropic", "claude-opus-5-5"),
		).modelOutput(plan, plan.unlockedTools);
		expect(replayed.type).toBe("content");
		expect(
			JSON.stringify(replayed.type === "content" && replayed.value.slice(1)),
		).toContain("createBehaviour");
	});

	test("prose naming an old tool stays as written", () => {
		expect<unknown>(result.parts.prose).toEqual(fixtures.prose);
	});
});
