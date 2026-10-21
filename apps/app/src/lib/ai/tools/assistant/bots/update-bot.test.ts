import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId, BotId } from "@orcai/core";
import type { BotEditor } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

beforeEach(() => {
	resetProcedures();
	answers["bot.findEditor"] = () =>
		Effect.succeed({
			data: editor,
		});
	answers["bot.save"] = () =>
		Effect.succeed({
			data: editor,
		});
});

const { updateBotPayload, updateBotTool } = await import("./update-bot");
const { createAssistantTurn } = await import("../turn-state");

const botId = crypto.randomUUID() as BotId;
const templateId = crypto.randomUUID() as BlockId;
const repositoryId = crypto.randomUUID() as BlockId;
const otherTemplateId = crypto.randomUUID() as BlockId;
const otherRepositoryId = crypto.randomUUID() as BlockId;

const block = (id: BlockId, name: string) => ({
	id,
	name,
	capabilities: {},
	description: null,
	contentJson: null,
	contentHtml: null,
	status: "ready" as const,
});

const editor: BotEditor = {
	id: botId,
	name: "Citation check",
	description: "Checks citations.",
	contentJson: {
		type: "doc",
	},
	contentHtml: "<p>Rich</p>",
	status: "ready",
	templateBlock: {
		...block(templateId, "Strict"),
		type: "template",
		config: {
			systemPrompt: "Be strict.",
		},
	},
	databaseBlocks: [
		{
			...block(repositoryId, "Sources"),
			type: "database",
			config: {
				minReferences: 1,
				maxReferences: 8,
				defaultReferences: 4,
			},
			assetIds: [],
			assets: [],
		},
	],
	features: {
		generativeUi: {},
	},
	capabilities: {},
};

describe("updateBotPayload", () => {
	test("an update keeps status, content, links and features it was not given", () => {
		expect(
			updateBotPayload(
				{
					id: botId,
					name: "Renamed",
					description: "New description.",
				},
				editor,
			),
		).toEqual({
			id: botId,
			name: "Renamed",
			description: "New description.",
			contentJson: {
				type: "doc",
			},
			contentHtml: "<p>Rich</p>",
			status: "ready",
			templateBlockId: templateId,
			databaseBlockIds: [
				repositoryId,
			],
			features: {
				generativeUi: {},
			},
		});
	});

	test("given links and features replace the stored ones", () => {
		expect(
			updateBotPayload(
				{
					id: botId,
					name: "Citation check",
					description: "Checks citations.",
					templateId: otherTemplateId,
					repositoryIds: [
						otherRepositoryId,
					],
					features: {},
				},
				editor,
			),
		).toMatchObject({
			status: "ready",
			contentHtml: "<p>Rich</p>",
			templateBlockId: otherTemplateId,
			databaseBlockIds: [
				otherRepositoryId,
			],
			features: {},
		});
	});

	test("null unlinks the template", () => {
		expect(
			updateBotPayload(
				{
					id: botId,
					name: "Citation check",
					description: "Checks citations.",
					templateId: null,
				},
				editor,
			).templateBlockId,
		).toBeNull();
	});

	test("an update takes only the changed fields", () => {
		expect(
			updateBotPayload(
				{
					id: botId,
					features: {},
				},
				editor,
			),
		).toMatchObject({
			name: "Citation check",
			description: "Checks citations.",
			templateBlockId: templateId,
			features: {},
		});
	});
});

describe("updateBotTool", () => {
	test("an update reads the editor record and saves it back merged", async () => {
		const tool = updateBotTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
			}),
		});

		const output = await tool.execute?.(
			{
				id: botId,
				name: "Renamed",
				description: "Checks citations.",
			},
			{
				toolCallId: "update",
				messages: [],
			} as never,
		);

		expect(
			procedureCalls
				.filter(({ procedure }) => procedure === "bot.save")
				.map(({ input }) => input),
		).toEqual([
			expect.objectContaining({
				id: botId,
				name: "Renamed",
				status: "ready",
				contentHtml: "<p>Rich</p>",
				templateBlockId: templateId,
				databaseBlockIds: [
					repositoryId,
				],
				features: {
					generativeUi: {},
				},
			}),
		]);
		expect(output).toMatchObject({
			type: "bot",
			id: botId,
			template: {
				type: "template",
				id: templateId,
				name: "Strict",
			},
			repositories: [
				{
					type: "repository",
					id: repositoryId,
					assetCount: 0,
				},
			],
		});
		expect(JSON.stringify(output)).not.toContain("Rich");
	});

	const run = (input: Record<string, unknown>) =>
		updateBotTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
			}),
		}).execute?.(
			input as never,
			{
				toolCallId: "update",
				messages: [],
			} as never,
		);

	test("a missing bot names the expected type", async () => {
		answers["bot.findEditor"] = () =>
			Effect.fail(
				new ORPCError("NOT_FOUND", {
					message: "Bot not found",
					data: {
						reason: "BOT_NOT_FOUND",
					},
				}),
			);

		await expect(
			run({
				id: botId,
				name: "Renamed",
			}),
		).rejects.toThrow(
			`BOT_NOT_FOUND: No bot with id ${botId}. Ids of other kinds (templates, repositories, assets, groups, members, invitations) are not bot ids.`,
		);
	});

	test("a template among the repositories reads as a wrong repository id", async () => {
		answers["bot.save"] = () =>
			Effect.fail(
				new ORPCError("BAD_REQUEST", {
					message: "Linked content collection block must be a database block.",
					data: {
						reason: "REPOSITORY_BLOCK_TYPE_INVALID",
					},
				}),
			);

		await expect(
			run({
				id: botId,
				repositoryIds: [
					otherTemplateId,
				],
			}),
		).rejects.toThrow(
			`REPOSITORY_BLOCK_TYPE_INVALID: No repository with id ${otherTemplateId}.`,
		);
	});
});
