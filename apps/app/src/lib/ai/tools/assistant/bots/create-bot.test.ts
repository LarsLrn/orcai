import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId, BotId } from "@orcai/core";
import type { BotEditor } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	answers,
	procedureCalls,
	resetProcedures,
	valkeyStore,
} from "../test-procedures";

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

const { createBotInputSchema, createBotPayload, createBotTool } = await import(
	"./create-bot"
);
const { createAssistantTurn } = await import("../turn-state");

const botId = crypto.randomUUID() as BotId;
const templateId = crypto.randomUUID() as BlockId;
const repositoryId = crypto.randomUUID() as BlockId;

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

describe("createBotPayload", () => {
	test("the schema requires a name and a description", () => {
		expect(
			createBotInputSchema.safeParse({
				name: "New bot",
			}).success,
		).toBe(false);
	});

	test("a create is a draft with empty content", () => {
		expect(
			createBotPayload({
				name: "New bot",
				description: "Does things.",
				repositoryIds: [
					repositoryId,
				],
				features: {
					generativeUi: {},
				},
			}),
		).toEqual({
			name: "New bot",
			description: "Does things.",
			contentJson: {},
			contentHtml: "",
			status: "draft",
			templateBlockId: null,
			databaseBlockIds: [
				repositoryId,
			],
			features: {
				generativeUi: {},
			},
		});
	});
});

describe("createBotTool", () => {
	const create = (toolCallId: string) =>
		createBotTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
			}),
		}).execute?.(
			{
				name: "Citation check",
				description: "Checks citations.",
			},
			{
				toolCallId,
				messages: [],
			} as never,
		);
	const saves = () =>
		procedureCalls.filter(({ procedure }) => procedure === "bot.save").length;

	test("the same call run again returns the bot it created", async () => {
		const first = await create("call-1");
		const again = await create("call-1");

		expect(saves()).toBe(1);
		expect(again).toEqual(first);
		expect(again).toMatchObject({
			id: botId,
		});
		expect(valkeyStore.size).toBe(1);
	});

	test("another call creates another bot", async () => {
		await create("call-1");
		await create("call-2");

		expect(saves()).toBe(2);
	});

	test("a bot deleted since is created anew", async () => {
		await create("call-1");
		answers["bot.findEditor"] = () =>
			Effect.fail(
				new ORPCError("NOT_FOUND", {
					message: "Bot not found",
					data: {
						reason: "BOT_NOT_FOUND",
					},
				}),
			);
		await create("call-1");

		expect(saves()).toBe(2);
	});

	test("a failed create that may have gone through says to check", async () => {
		answers["bot.save"] = () =>
			Effect.fail(
				new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "connection reset",
				}),
			);

		await expect(create("call-1")).rejects.toThrow(
			"INTERNAL_SERVER_ERROR: The request failed on the server. The change may have been applied anyway; check with findBots before retrying.",
		);
		expect(valkeyStore.size).toBe(0);
	});

	test("a rejected create does not say so", async () => {
		answers["bot.save"] = () =>
			Effect.fail(
				new ORPCError("FORBIDDEN", {
					message: "You may not create bots.",
					data: {
						reason: "PERMISSION_DENIED",
					},
				}),
			);

		await expect(create("call-1")).rejects.toThrow(
			/^PERMISSION_DENIED: You may not create bots\.$/,
		);
	});
});
