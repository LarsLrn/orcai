import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId, BotId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import type { Tool } from "ai";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const { findBotsTool } = await import("./find-bots");
const { getBotTool } = await import("./get-bot");
const { findBlocksTool } = await import("./find-blocks");
const { findAssetsTool } = await import("./find-assets");
const { createAssistantTurn } = await import("../turn-state");

const deps = () => ({
	context: {
		secureCookies: false,
	} as ORPCContext,
	turn: createAssistantTurn({
		zedToken: undefined,
		chatId: "chat",
		replyId: "reply",
	}),
});

/** Runs a tool's execute; these tools answer with a promise, never a stream. */
const run = async <Input, Output>(
	tool: Tool<Input, Output>,
	input: Input,
): Promise<Output> =>
	(await tool.execute?.(input, {
		toolCallId: "call-1",
		messages: [],
		context: {},
	})) as Output;

const id = <Id extends string>() => crypto.randomUUID() as Id;

const bot = (
	name: string,
	status: "draft" | "ready",
	canEdit: boolean,
	isFavourite = false,
) => ({
	id: id<BotId>(),
	name,
	description: `${name} description.`,
	status,
	isFavourite,
	contentJson: {
		type: "doc",
	},
	contentHtml: "<p>Rich</p>",
	capabilities: {
		read: true,
		edit: canEdit,
	},
});

const block = (
	name: string,
	type: "template" | "database",
	status: "draft" | "ready" = "ready",
) => ({
	id: id<BlockId>(),
	name,
	type,
	status,
	description: null,
	contentJson: {
		type: "doc",
	},
	contentHtml: "<p>Rich</p>",
	capabilities: {
		read: true,
	},
});

beforeEach(resetProcedures);

describe("findBots", () => {
	const ready = [
		bot("Citation check", "ready", false),
		bot("Citation style", "ready", true, true),
	];
	const draft = bot("Citation draft", "draft", true);

	beforeEach(() => {
		answers["bot.list"] = (input: { pageSize: number }) =>
			Effect.succeed({
				data: ready.slice(0, input.pageSize),
				rowCount: 5,
			});
		answers["bot.listDrafts"] = (input: { pageSize: number }) =>
			Effect.succeed({
				data: [
					draft,
				].slice(0, input.pageSize),
				rowCount: 1,
			});
	});

	test("merges published bots and drafts with both totals", async () => {
		const output = await run(findBotsTool(deps()), {
			query: "citation",
			limit: 20,
		});

		expect(output).toEqual({
			bots: [
				...ready,
				draft,
			].map((found) => ({
				type: "bot",
				id: found.id,
				name: found.name,
				description: found.description,
				status: found.status,
				canEdit: found.capabilities.edit,
				favourite: found.isFavourite,
			})),
			total: 6,
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "bot.list",
				input: {
					pageSize: 20,
					search: "citation",
				},
			},
			{
				procedure: "bot.listDrafts",
				input: {
					pageSize: 20,
					search: "citation",
				},
			},
		]);
	});

	test("returns at most limit bots", async () => {
		const output = await run(findBotsTool(deps()), {
			limit: 2,
		});

		expect(output.bots.map((found) => found.name)).toEqual([
			"Citation check",
			"Citation style",
		]);
		expect(output.total).toBe(6);
	});
});

describe("getBot", () => {
	const template = block("Strict", "template");
	const repository = block("Sources", "database", "draft");
	const hidden = block("Hidden", "database");
	const assets = [
		id<AssetId>(),
		id<AssetId>(),
	];

	const found = (capabilities: Record<string, boolean>) => ({
		data: {
			...bot("Citation check", "ready", capabilities.edit === true),
			features: {
				generativeUi: {},
			},
			blockIds: [
				template.id,
				repository.id,
				hidden.id,
			],
			capabilities,
		},
	});

	test("a reader gets the linked blocks they can read", async () => {
		const reader = found({
			read: true,
		});
		answers["bot.find"] = () => Effect.succeed(reader);
		answers["block.find"] = (input: { id: BlockId }) =>
			input.id === template.id
				? Effect.succeed({
						data: template,
					})
				: input.id === repository.id
					? Effect.succeed({
							data: repository,
							assets: assets.map((assetId) => ({
								id: assetId,
							})),
						})
					: Effect.fail(
							new ORPCError("FORBIDDEN", {
								data: {
									reason: "PERMISSION_DENIED",
								},
							}),
						);

		const output = await run(getBotTool(deps()), {
			id: reader.data.id,
		});

		expect(output).toEqual({
			type: "bot",
			id: reader.data.id,
			name: "Citation check",
			description: "Citation check description.",
			status: "ready",
			features: {
				generativeUi: {},
			},
			template: {
				type: "template",
				id: template.id,
				name: "Strict",
				status: "ready",
			},
			repositories: [
				{
					type: "repository",
					id: repository.id,
					name: "Sources",
					status: "draft",
					assetCount: 2,
				},
			],
			canEdit: false,
			canDelete: false,
			canManageAccess: false,
		});
		expect(procedureCalls.map((call) => call.procedure)).not.toContain(
			"bot.findEditor",
		);
	});

	test("an editor gets the links from the editor view", async () => {
		const editable = found({
			read: true,
			edit: true,
			delete: true,
			manage_access: true,
		});
		answers["bot.find"] = () => Effect.succeed(editable);
		answers["bot.findEditor"] = () =>
			Effect.succeed({
				data: {
					...editable.data,
					templateBlock: {
						...template,
						config: {
							systemPrompt: "Be strict.",
						},
					},
					databaseBlocks: [
						{
							...repository,
							assetIds: assets,
							assets: [],
						},
						{
							...hidden,
							assetIds: [],
							assets: [],
						},
					],
				},
			});

		const output = await run(getBotTool(deps()), {
			id: editable.data.id,
		});

		expect(output).toMatchObject({
			template: {
				id: template.id,
				name: "Strict",
				status: "ready",
			},
			repositories: [
				{
					id: repository.id,
					assetCount: 2,
				},
				{
					id: hidden.id,
					assetCount: 0,
				},
			],
			canEdit: true,
			canDelete: true,
			canManageAccess: true,
		});
		expect(Object.keys(output)).not.toContain("contentJson");
		expect(Object.keys(output)).not.toContain("contentHtml");
		expect(procedureCalls.map((call) => call.procedure)).toEqual([
			"bot.find",
			"bot.findEditor",
		]);
	});

	test("a bot without a template has none", async () => {
		const reader = found({
			read: true,
		});
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					...reader.data,
					blockIds: [],
				},
			});

		const output = await run(getBotTool(deps()), {
			id: reader.data.id,
		});

		expect(output).toMatchObject({
			template: null,
			repositories: [],
		});
	});
});

describe("findBlocks", () => {
	test("a repository search lists ready and draft database blocks", async () => {
		const readyBlock = block("Sources", "database");
		const draftBlock = block("Sources draft", "database", "draft");
		answers["block.list"] = (input: {
			filters: {
				status: string;
			};
		}) =>
			Effect.succeed(
				input.filters.status === "ready"
					? {
							data: [
								readyBlock,
							],
							rowCount: 1,
						}
					: {
							data: [
								draftBlock,
							],
							rowCount: 3,
						},
			);

		const output = await run(findBlocksTool(deps()), {
			type: "repository",
			query: "sources",
			limit: 10,
		});

		expect(output).toEqual({
			blocks: [
				{
					type: "repository",
					id: readyBlock.id,
					name: "Sources",
					description: null,
					status: "ready",
					canEdit: false,
				},
				{
					type: "repository",
					id: draftBlock.id,
					name: "Sources draft",
					description: null,
					status: "draft",
					canEdit: false,
				},
			],
			total: 4,
		});
		expect(procedureCalls.map((call) => call.input)).toEqual(
			[
				"ready",
				"draft",
			].map((status) => ({
				pageSize: 10,
				filters: {
					type: "database",
					status,
					search: "sources",
				},
			})),
		);
	});
});

describe("findAssets", () => {
	test("narrows to the repository and trims each asset", async () => {
		const repositoryId = id<BlockId>();
		const assetId = id<AssetId>();
		answers["asset.list"] = () =>
			Effect.succeed({
				data: [
					{
						id: assetId,
						title: "Handbook",
						processingStatus: "completed",
						origin: "chat",
						metadata: {
							authors: [
								"Anna",
							],
						},
						capabilities: {
							read: true,
							edit: true,
						},
					},
				],
				rowCount: 7,
			});

		const output = await run(findAssetsTool(deps()), {
			repositoryId,
			limit: 1,
		});

		expect(output).toEqual({
			assets: [
				{
					type: "asset",
					id: assetId,
					title: "Handbook",
					processingStatus: "completed",
					origin: "chat",
					canEdit: true,
				},
			],
			total: 7,
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "asset.list",
				input: {
					pageSize: 1,
					filters: {
						search: undefined,
						repositoryId,
					},
				},
			},
		]);
	});
});
