import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId, BotId, ModelId, ProviderId } from "@orcai/core";
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
	capabilities: {
		read: true,
		edit: canEdit,
	},
});

const block = (
	name: string,
	type: "behaviour" | "repository",
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
	capabilities: {
		read: true,
	},
});

beforeEach(() => {
	resetProcedures();
	answers["botSetup.find"] = () =>
		Effect.succeed({
			data: {
				setup: null,
				canEdit: false,
			},
		});
});

describe("findBots", () => {
	const found = [
		bot("Citation check", "ready", false),
		bot("Citation draft", "draft", true),
		bot("Citation style", "ready", true, true),
	];

	beforeEach(() => {
		answers["bot.list"] = (input: { pageSize: number }) =>
			Effect.succeed({
				data: found.slice(0, input.pageSize),
				rowCount: 6,
			});
	});

	test("lists published bots and drafts in one page with its total", async () => {
		const output = await run(findBotsTool(deps()), {
			query: "citation",
			limit: 20,
		});

		expect(output).toEqual({
			bots: found.map((entry) => ({
				id: entry.id,
				name: entry.name,
				description: entry.description,
				status: entry.status,
				canEdit: entry.capabilities.edit,
				favourite: entry.isFavourite,
			})),
			total: 6,
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "bot.list",
				input: {
					pageSize: 20,
					search: "citation",
					filters: {
						status: "all",
					},
				},
			},
		]);
	});

	test("forwards a smaller limit", async () => {
		const output = await run(findBotsTool(deps()), {
			limit: 2,
		});

		expect(output.bots).toHaveLength(2);
		expect(procedureCalls.map((call) => call.input)).toEqual([
			{
				pageSize: 2,
				filters: {
					status: "all",
				},
			},
		]);
	});
});

describe("getBot", () => {
	const behaviour = block("Strict", "behaviour");
	const repository = block("Sources", "repository", "draft");
	const hidden = block("Hidden", "repository");
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
				behaviour.id,
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
			input.id === behaviour.id
				? Effect.succeed({
						data: behaviour,
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
			behaviour: {
				type: "behaviour",
				id: behaviour.id,
				name: "Strict",
				status: "ready",
			},
			repositories: [
				{
					id: repository.id,
					name: "Sources",
					status: "draft",
					assetCount: 2,
				},
			],
			setup: null,
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
					behaviour: {
						...behaviour,
						config: {
							systemPrompt: "Be strict.",
						},
					},
					repositories: [
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

		const tutor = {
			id: crypto.randomUUID() as ModelId,
			name: "Tutor model",
			providerId: crypto.randomUUID() as ProviderId,
			usable: true,
		};
		answers["botSetup.find"] = () =>
			Effect.succeed({
				data: {
					setup: {
						model: tutor,
						strength: "required",
						generation: {},
					},
					canEdit: true,
				},
			});
		answers["botSetup.coverage"] = () =>
			Effect.succeed({
				data: {
					principals: [
						{
							principal: {
								name: "Seminar A",
							},
							covered: true,
						},
						{
							principal: {
								name: "Seminar B",
							},
							covered: false,
						},
					],
				},
			});

		const output = await run(getBotTool(deps()), {
			id: editable.data.id,
		});

		expect(output).toMatchObject({
			behaviour: {
				id: behaviour.id,
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
			setup: {
				model: {
					id: tutor.id,
					name: "Tutor model",
					usable: true,
				},
				strength: "required",
				coverage: {
					covered: 1,
					total: 2,
					notCovered: [
						"Seminar B",
					],
				},
			},
			canEdit: true,
			canDelete: true,
			canManageAccess: true,
		});
		expect(Object.keys(output)).not.toContain("contentJson");
		expect(procedureCalls.map((call) => call.procedure)).toEqual([
			"bot.find",
			"bot.findEditor",
			"botSetup.find",
			"botSetup.coverage",
		]);
	});

	test("a bot without a behaviour has none", async () => {
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
			behaviour: null,
			repositories: [],
		});
	});
});

describe("findBlocks", () => {
	test("a repository search lists ready and draft repositories", async () => {
		const readyBlock = block("Sources", "repository");
		const draftBlock = block("Sources draft", "repository", "draft");
		answers["block.list"] = () =>
			Effect.succeed({
				data: [
					readyBlock,
					draftBlock,
				],
				rowCount: 4,
			});

		const output = await run(findBlocksTool(deps()), {
			type: "repository",
			query: "sources",
			limit: 10,
		});

		expect(output).toEqual({
			blocks: [
				{
					id: readyBlock.id,
					name: "Sources",
					description: null,
					status: "ready",
					canEdit: false,
				},
				{
					id: draftBlock.id,
					name: "Sources draft",
					description: null,
					status: "draft",
					canEdit: false,
				},
			],
			total: 4,
		});
		expect(procedureCalls.map((call) => call.input)).toEqual([
			{
				pageSize: 10,
				filters: {
					type: "repository",
					status: "all",
					search: "sources",
				},
			},
		]);
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
						keptIn: "chat",
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
					id: assetId,
					title: "Handbook",
					processingStatus: "completed",
					keptIn: "chat",
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
