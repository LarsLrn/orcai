import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId, BotId, ModelId, ProviderId } from "@orcai/core";
import type { BotEditor, BotSetup, BotSetupFields } from "@orcai/schema";
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

const { createBotInputSchema, createBotPayload, createBotTool } = await import(
	"./create-bot"
);
const { createAssistantTurn } = await import("../turn-state");

const botId = crypto.randomUUID() as BotId;
const behaviourId = crypto.randomUUID() as BlockId;
const repositoryId = crypto.randomUUID() as BlockId;

const block = (id: BlockId, name: string) => ({
	id,
	name,
	capabilities: {},
	description: null,
	contentJson: null,
	status: "ready" as const,
});

const editor: BotEditor = {
	id: botId,
	name: "Citation check",
	description: "Checks citations.",
	contentJson: {
		type: "doc",
	},
	status: "ready",
	behaviour: {
		...block(behaviourId, "Strict"),
		type: "behaviour",
		config: {
			systemPrompt: "Be strict.",
		},
	},
	repositories: [
		{
			...block(repositoryId, "Sources"),
			type: "repository",
			config: {
				minPassages: 1,
				maxPassages: 8,
				defaultPassages: 4,
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
			status: "draft",
			behaviourId: null,
			repositoryIds: [
				repositoryId,
			],
			features: {
				generativeUi: {},
			},
			listBlockIds: [],
		});
	});
});

describe("createBotTool", () => {
	const create = (toolCallId: string, setup?: BotSetupFields | null) =>
		createBotTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
			}),
		}).execute?.(
			{
				name: "Citation check",
				description: "Checks citations.",
				setup,
			},
			{
				toolCallId,
				messages: [],
			} as never,
		);

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
	});

	describe("with a setup", () => {
		const modelId = crypto.randomUUID() as ModelId;
		const setup = {
			modelId,
			strength: "required" as const,
			generation: {},
		};
		const stored: BotSetup = {
			model: {
				id: modelId,
				name: "Tutor model",
				providerId: crypto.randomUUID() as ProviderId,
				usable: true,
			},
			strength: "required",
			generation: {},
		};
		const setupSaves = () =>
			procedureCalls.filter(({ procedure }) => procedure === "botSetup.save")
				.length;

		beforeEach(() => {
			answers["botSetup.save"] = () =>
				Effect.succeed({
					data: stored,
				});
			answers["botSetup.find"] = () =>
				Effect.succeed({
					data: {
						setup: null,
						canEdit: true,
					},
				});
			answers["botSetup.coverage"] = () =>
				Effect.succeed({
					data: {
						principals: [],
					},
				});
		});

		test("a rejected setup keeps the created bot and says why", async () => {
			answers["botSetup.save"] = () =>
				Effect.fail(
					new ORPCError("NOT_FOUND", {
						message: "Model not found",
						data: {
							reason: "MODEL_NOT_FOUND",
						},
					}),
				);

			const output = await create("call-1", setup);

			expect(output).toMatchObject({
				id: botId,
				setupError: "MODEL_NOT_FOUND: Model not found",
			});
		});

		test("a saved setup whose coverage cannot be read keeps the created bot", async () => {
			answers["botSetup.coverage"] = () =>
				Effect.fail(
					new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "SpiceDB unavailable",
					}),
				);

			const output = await create("call-1", setup);

			expect(output).toMatchObject({
				id: botId,
				setup: {
					model: {
						id: modelId,
					},
				},
				setupError: expect.stringContaining("The setup was saved"),
			});
			expect(setupSaves()).toBe(1);
		});
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
	test("a block-link rejection names requested kinds without exposing existence", async () => {
		answers["bot.save"] = () =>
			Effect.fail(
				new ORPCError("FORBIDDEN", {
					message: "No access to link",
					data: {
						reason: "BLOCK_LINK_FORBIDDEN",
					},
				}),
			);
		await expect(
			createBotTool({
				context: {} as ORPCContext,
				turn: createAssistantTurn({
					zedToken: undefined,
				}),
			}).execute?.(
				{
					name: "New bot",
					description: "New bot",
					behaviourId,
					repositoryIds: [
						repositoryId,
					],
				},
				{
					toolCallId: "link",
					messages: [],
				} as never,
			),
		).rejects.toThrow(
			`BLOCK_LINK_FORBIDDEN: You cannot link one or more of these in this organisation: behaviour ${behaviourId}, repository ${repositoryId}. Use a behaviour or repository from findBlocks that you may use in this organisation, create one with createBehaviour or createRepository, or remove the link from the bot.`,
		);
	});
});
