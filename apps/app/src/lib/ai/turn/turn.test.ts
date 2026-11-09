import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BotId, ChatMessageId } from "@orcai/core";
import { promptTokens } from "@orcai/quota";
import { quota } from "@orcai/quota/testing";
import type { TurnWrite } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import {
	readUIMessageStream,
	simulateReadableStream,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { sourceRef } from "../citations/source-ref";
import { toChatAgentParts } from "../messages/chat-agent-message";
import { TOOL_CLOSE_SENTENCES } from "../messages/close-pending-tool-parts";
import {
	answers,
	procedureCalls,
	resetProcedures,
} from "../tools/assistant/test-procedures";
import { assetPoint } from "../tools/rag/test-points";
import {
	answerSetup,
	assistantRow,
	chatRow,
	conversation,
	drain,
	ORGANIZATION_ID,
	runTurn,
	turnWaits,
} from "./test-turn";

const { ReplyStore } = await import("./reply-store");
const { keepUploads } = await import("./turn");
const { memoryReplyStore } = await import("./memory-reply-store");
const AppErrors = await import("@/lib/effect/utils/errors");

beforeEach(() => {
	resetProcedures();
	quota.reset();
	answerSetup({
		providerKind: "anthropic",
		providerModelId: "claude-opus-5-5",
	});
});

const deleteDraft = {
	name: "deleteBot",
	input: {
		ids: [
			crypto.randomUUID(),
		],
	},
};

const textOf = (parts: unknown[]) =>
	parts.flatMap((part) =>
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		part.type === "text" &&
		"text" in part
			? [
					part.text,
				]
			: [],
	);

const toolStates = (parts: unknown[]) =>
	parts.flatMap((part) =>
		typeof part === "object" &&
		part !== null &&
		"toolCallId" in part &&
		"state" in part
			? [
					part.state,
				]
			: [],
	);

/** Why a turn was refused, or nothing when it ran. */
const refusal = async (run: () => Promise<unknown>) => {
	try {
		await run();
		return undefined;
	} catch (error) {
		const failure = error as {
			_tag?: string;
			reason?: string;
		};
		return `${failure._tag}: ${failure.reason}`;
	}
};

/** An assistant conversation whose reply waits for approval to delete a draft. */
const pausedAssistant = async () => {
	const chat = await conversation(assistantRow(), "anthropic");
	chat.script([
		{
			calls: [
				deleteDraft,
			],
		},
	]);
	await chat.send("Delete the old draft");
	return chat;
};

describe("startTurn", () => {
	test("stores the question and the reply, and charges the steps it ran", async () => {
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);

		await chat.send("Hi");

		expect(
			chat.messages().map((message) => [
				message.role,
				textOf(message.parts),
			]),
		).toEqual([
			[
				"user",
				[
					"Hi",
				],
			],
			[
				"assistant",
				[
					"Hello.",
				],
			],
		]);
		expect(chat.messages().at(-1)?.metadata.interrupted).toBe(false);
		expect(quota.calls.settle).toHaveLength(1);
		expect(quota.calls.settle[0]?.steps).toHaveLength(1);
	});

	test("reserves the turn's instructions and tools along with its messages", async () => {
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);

		await chat.send("Hi");

		const [question] = chat.messages();
		expect(quota.calls.reserve[0]?.inputTokens).toBeGreaterThan(
			promptTokens([
				question,
			]),
		);
	});

	test("records each finished step while the turn runs", async () => {
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"anthropic",
		);
		chat.script([
			{
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				text: "Checked.",
			},
		]);

		await chat.send("Check it");

		expect(quota.calls.record.map(({ steps }) => steps.length)).toEqual([
			1,
			2,
		]);
	});

	test.each([
		"anthropic",
		"openai",
		"openai-compatible",
	] as const)(
		"keeps a reply whose %s stream was cut off, and marks it",
		async (kind) => {
			answerSetup({
				providerKind: kind,
				providerModelId: kind === "anthropic" ? "claude-opus-5-5" : "gpt-5.5",
			});
			const chat = await conversation(chatRow(), kind);
			chat.script([
				{
					text: "The first half",
					cutOff: true,
				},
			]);

			await chat.send("Hi");

			const reply = chat.messages().at(-1);
			expect(textOf(reply?.parts ?? [])).toEqual([
				"The first half",
			]);
			expect(reply?.metadata.interrupted).toBe(true);
			expect(quota.calls.settle).toHaveLength(1);
		},
	);

	test("marks a reply cut off when a later step fails after its output", async () => {
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"anthropic",
		);
		chat.script([
			{
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				refused: true,
			},
		]);

		await chat.send("Check it");

		const reply = chat.messages().at(-1);
		expect(toolStates(reply?.parts ?? [])).toEqual([
			"output-available",
		]);
		expect(reply?.metadata.interrupted).toBe(true);
	});

	test("charges a stopped turn the tokens of its finished steps", async () => {
		quota.reservation = {
			meteringMode: "tokens",
			reservedAmount: 100_000,
		};
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"anthropic",
		);
		const stop = new AbortController();
		chat.script([
			{
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				text: "Never read.",
			},
		]);
		// The user stops while the second step is in flight.
		chat.beforeRequest((count) => {
			if (count === 2) {
				stop.abort();
			}
		});

		await chat.send("Check it", stop.signal);

		expect(quota.calls.settle).toHaveLength(1);
		expect(quota.calls.settle[0]?.steps).toMatchObject([
			{
				totalTokens: 2,
			},
		]);
		expect(chat.messages().at(-1)?.metadata.timeLimitReached).toBeUndefined();
		expect(chat.messages().at(-1)?.metadata.interrupted).toBeUndefined();
	});

	test("ends a turn that runs out of time like a stopped one, and says so", async () => {
		quota.reservation = {
			meteringMode: "tokens",
			reservedAmount: 100_000,
		};
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"anthropic",
		);
		chat.script([
			{
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				text: "Never read.",
			},
		]);
		// The time runs out while the second step is in flight.
		chat.beforeRequest((count) => {
			if (count === 2) {
				quota.timeLimit.abort();
			}
		});

		await chat.send("Write it");

		expect(quota.calls.settle).toHaveLength(1);
		expect(quota.calls.settle[0]?.steps).toHaveLength(1);
		expect(chat.messages().at(-1)?.metadata.timeLimitReached).toBe(true);
	});

	test("leaves no reply when the turn produced nothing, and releases its quota", async () => {
		const chat = await conversation(chatRow(), "anthropic");

		await chat.send("Hi");

		expect(chat.messages().map((message) => message.role)).toEqual([
			"user",
		]);
		expect(quota.calls.settle).toEqual([
			expect.objectContaining({
				steps: [],
				reason: "provider_failure",
			}),
		]);
	});

	test("stores nothing when the quota refuses the turn", async () => {
		quota.reservation = {
			denial: "QUOTA_EXHAUSTED",
		};
		const chat = await conversation(chatRow(), "anthropic");

		expect(await refusal(() => chat.send("Hi"))).toBe(
			"QuotaDeniedError: QUOTA_EXHAUSTED",
		);
		expect(chat.messages()).toEqual([]);
		expect(chat.bodies).toEqual([]);
	});

	test("refuses a message id that is taken, and releases the quota", async () => {
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);
		await chat.send("Hi");
		const [question] = chat.messages();

		expect(
			await refusal(() =>
				chat.run(
					chat.start({
						...chat.requester,
						chatId: question?.chatId ?? chatRow().id,
						message: {
							id: question?.id as ChatMessageId,
							role: "user",
							attachments: [],
							parts: [],
						},
						stop: undefined,
					}),
				),
			),
		).toBe("BadRequestError: CHAT_MESSAGE_ID_TAKEN");
		expect(chat.messages()).toHaveLength(2);
		expect(quota.calls.settle.at(-1)).toMatchObject({
			steps: [],
			reason: "app_failure",
		});
	});

	test("closes the last reply's pending calls when a new message supersedes them", async () => {
		const chat = await pausedAssistant();
		chat.script([
			{
				text: "Kept it.",
			},
		]);

		await chat.send("Keep it");

		const [, reply] = chat.messages();
		expect(toolStates(reply?.parts ?? [])).toEqual([
			"output-denied",
		]);
	});

	test("settles the quota even when the reply cannot be stored", async () => {
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);
		const store = Effect.runSync(
			Effect.gen(function* () {
				return yield* ReplyStore;
			}).pipe(Effect.provide(chat.store.layer)),
		);
		const failingSettle = Layer.succeed(ReplyStore, {
			...store,
			settle: () =>
				Effect.fail(
					new AppErrors.InternalError({
						operation: "test",
						cause: new Error("down"),
					}),
				),
		});

		await drain(
			await chat.run(
				chat.start({
					...chat.requester,
					chatId: chat.chatId,
					message: {
						id: crypto.randomUUID() as ChatMessageId,
						role: "user",
						attachments: [],
						parts: [
							{
								type: "text",
								text: "Hi",
							},
						],
					},
					stop: undefined,
				}),
				failingSettle,
			),
		);

		expect(quota.calls.settle).toHaveLength(1);
	});
});

describe("context window", () => {
	/** A question the estimate counts as about 30 000 tokens. */
	const long = (letter: string) => letter.repeat(120_000);

	/** At least 63 000 tokens, so Anthropic compacts natively and only trimming makes room. */
	const narrowModel = (contextWindow: number) =>
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			model: {
				contextWindow,
				maxOutputTokens: 1_000,
			},
		});

	test("leaves out the oldest turns once the history outgrows the window, and marks the reply", async () => {
		narrowModel(90_000);
		const chat = await conversation(chatRow(), "anthropic");
		// The provider counts what each request sent, which the next turn reads back.
		chat.script([
			{
				text: "One.",
				inputTokens: 30_150,
			},
			{
				text: "Two.",
				inputTokens: 60_300,
			},
			{
				text: "Three.",
			},
		]);

		await chat.send(long("a"));
		await chat.send(long("b"));
		await chat.send(long("c"));

		const sent = chat.bodies.map((body) => JSON.stringify(body.messages));
		expect(sent[1]).toContain(long("a"));
		expect(sent[2]).not.toContain(long("a"));
		expect(sent[2]).toContain(long("b"));
		expect(sent[2]).toContain(long("c"));
		expect(
			chat
				.messages()
				.filter((message) => message.role === "assistant")
				.map((message) => message.metadata.historyTrimmed ?? false),
		).toEqual([
			false,
			false,
			true,
		]);
	});

	test("a small model without an output cap asks for at most half its window", async () => {
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			model: {
				contextWindow: 8_000,
			},
		});
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);

		await chat.send("Hi");

		expect(chat.bodies[0]?.max_tokens).toBe(4_000);
		expect(quota.calls.reserve[0]?.maxOutputTokens).toBe(4_000);
	});

	test("meters a continuation by the prompt that fits, before claiming the reply", async () => {
		narrowModel(90_000);
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				text: "One.",
				inputTokens: 30_150,
			},
			{
				text: "Two.",
				inputTokens: 60_300,
			},
			{
				calls: [
					deleteDraft,
				],
				inputTokens: 75_000,
			},
			{
				text: "Kept.",
			},
		]);
		await chat.send(long("a"));
		await chat.send(long("b"));
		await chat.send(long("c"));

		await chat.decide(false);

		// Each long turn is about 30 000 tokens; only the latest is kept.
		const reserved = quota.calls.reserve.at(-1)?.inputTokens ?? 0;
		expect(reserved).toBeGreaterThan(30_000);
		expect(reserved).toBeLessThan(60_000);
		expect(JSON.stringify(chat.bodies.at(-1)?.messages)).not.toContain(
			long("a"),
		);
		expect(chat.messages().at(-1)?.metadata.historyTrimmed).toBe(true);
	});

	test("every step asks for the output the turn reserved", async () => {
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"anthropic",
		);
		chat.script([
			{
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				text: "Checked.",
			},
		]);
		const assistant = await pausedAssistant();
		assistant.script([
			{
				text: "Kept.",
			},
		]);

		await chat.send("Check it");
		await assistant.decide(false);

		expect(
			[
				...chat.bodies,
				...assistant.bodies,
			].map((body) => body.max_tokens),
		).toEqual([
			16_384,
			16_384,
			16_384,
			16_384,
		]);
		expect(quota.calls.reserve.at(-1)?.maxOutputTokens).toBe(16_384);
	});

	test("refuses a message that alone outgrows the window, before storing or reserving anything", async () => {
		narrowModel(15_000);
		const chat = await conversation(chatRow(), "anthropic");

		expect(await refusal(() => chat.send(long("a")))).toBe(
			"BadRequestError: CHAT_CONTEXT_TOO_LONG",
		);
		expect(chat.messages()).toEqual([]);
		expect(chat.bodies).toEqual([]);
		expect(quota.calls.reserve).toEqual([]);
	});
});

/**
 * With 1 000 tokens reserved for output, a chat's instructions and two long
 * turns of 2 000 tokens stay below the 80% trigger; a third outgrows it all.
 */
const WINDOW = 10_100;

describe("compaction", () => {
	const long = (letter: string) => letter.repeat(8_000);

	const model = (
		providerKind: "anthropic" | "openai" | "openai-compatible",
		contextWindow: number,
	) =>
		answerSetup({
			providerKind,
			providerModelId: providerKind === "anthropic" ? "claude-opus-5-5" : "gpt",
			model: {
				contextWindow,
				maxOutputTokens: 1_000,
			},
		});

	const partsOf = (
		index: number,
		chat: Awaited<ReturnType<typeof conversation>>,
	) =>
		chat.messages()[index]?.parts as {
			type: string;
			text?: string;
			providerMetadata?: unknown;
		}[];

	test("Anthropic compacts on its server; the next turn starts at the compaction block", async () => {
		model("anthropic", 200_000);
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "One.",
			},
			{
				compaction: "The story so far.",
				text: "Two.",
			},
			{
				text: "Three.",
			},
		]);

		await chat.send("Hi");
		await chat.send("Go on");
		await chat.send("And then?");

		expect(chat.bodies[1]?.context_management).toEqual({
			edits: [
				expect.objectContaining({
					type: "compact_20260112",
					trigger: {
						type: "input_tokens",
						value: 159_200,
					},
				}),
			],
		});
		expect(partsOf(3, chat)).toContainEqual(
			expect.objectContaining({
				type: "text",
				text: "The story so far.",
				providerMetadata: {
					anthropic: {
						type: "compaction",
					},
				},
			}),
		);
		expect(chat.bodies[2]?.messages).toEqual([
			{
				role: "assistant",
				content: [
					expect.objectContaining({
						type: "compaction",
						content: "The story so far.",
					}),
					expect.objectContaining({
						type: "text",
						text: "Two.",
					}),
				],
			},
			{
				role: "user",
				content: [
					expect.objectContaining({
						text: "And then?",
					}),
				],
			},
		]);
	});

	test("OpenAI compacts on its server; the item replays from what we stored", async () => {
		model("openai", 200_000);
		const chat = await conversation(chatRow(), "openai");
		chat.script([
			{
				compaction: "The story so far.",
				text: "One.",
			},
			{
				text: "Two.",
			},
		]);

		await chat.send("Hi");
		await chat.send("Go on");

		expect(chat.bodies.map((body) => body.store)).toEqual([
			false,
			false,
		]);
		expect(chat.bodies[0]?.context_management).toEqual([
			{
				type: "compaction",
				compact_threshold: 159_200,
			},
		]);
		expect(partsOf(1, chat)).toContainEqual(
			expect.objectContaining({
				type: "custom",
				kind: "openai.compaction",
			}),
		);
		const input = chat.bodies[1]?.input as unknown[];
		// The system prompt comes first.
		expect(input.at(1)).toEqual({
			type: "compaction",
			id: "cmp_1",
			encrypted_content: "sealed:The story so far.",
		});
		expect(JSON.stringify(input)).not.toContain("Hi");
	});

	test("OpenAI replays a step's reasoning within the turn from its encrypted content", async () => {
		answerSetup({
			providerKind: "openai",
			providerModelId: "gpt-5.5",
		});
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					features: {
						generativeUi: {},
					},
				} as never,
			}),
			"openai",
		);
		chat.script([
			{
				reasoning: "List the scope.",
				calls: [
					{
						name: "showChecklist",
						input: {
							items: [
								{
									label: "Scope",
								},
							],
						},
					},
				],
			},
			{
				text: "Listed.",
			},
		]);

		await chat.send("Check it");

		expect(chat.bodies[0]?.include).toContain("reasoning.encrypted_content");
		expect(chat.bodies[1]?.input).toContainEqual(
			expect.objectContaining({
				type: "reasoning",
				encrypted_content: "sealed:List the scope.",
			}),
		);
	});

	describe("our own summary", () => {
		/** Two long turns, then a third that reaches the trigger. */
		const longChat = async (
			summary: Parameters<
				Awaited<ReturnType<typeof conversation>>["script"]
			>[0][number],
		) => {
			model("openai-compatible", WINDOW);
			const chat = await conversation(chatRow(), "openai-compatible");
			// The provider counts what the estimate does.
			chat.script([
				{
					text: "One.",
					inputTokens: 5_150,
				},
				{
					text: "Two.",
					inputTokens: 7_160,
				},
				summary,
				{
					text: "Three.",
				},
			]);
			await chat.send(long("a"));
			await chat.send(long("b"));
			await chat.send(long("c"));
			return chat;
		};

		test("is streamed as the reply's first part, metered on its own, and starts the next prompts", async () => {
			const chat = await longChat({
				text: "Earlier: a and b.",
			});
			const replyId = chat.messages()[5]?.id;

			// The summary reads the history as a transcript, without tools.
			expect(chat.bodies[2]?.stream).toBeUndefined();
			expect(JSON.stringify(chat.bodies[2]?.messages)).toContain(long("a"));
			expect(chat.bodies[2]?.tools).toBeUndefined();
			expect(chat.bodies[3]?.messages).toEqual([
				expect.objectContaining({
					role: "system",
				}),
				{
					role: "user",
					content: "Summary of the earlier conversation:\n\nEarlier: a and b.",
				},
				{
					role: "user",
					content: long("c"),
				},
			]);
			expect(
				partsOf(5, chat).map(({ type, text }) => [
					type,
					text,
				]),
			).toEqual([
				[
					"text",
					"Earlier: a and b.",
				],
				[
					"step-start",
					undefined,
				],
				[
					"text",
					"Three.",
				],
			]);
			expect(
				quota.calls.reserve.map(({ appRequestId }) => appRequestId),
			).toContain(`compaction:${replyId}`);
			expect(chat.messages()[5]?.metadata.historyTrimmed).toBeUndefined();

			chat.script([
				{
					text: "Four.",
				},
			]);
			await chat.send("d");
			const next = JSON.stringify(chat.bodies[4]?.messages);
			expect(next).toContain("Earlier: a and b.");
			expect(next).not.toContain(long("a"));
			expect(next).toContain(long("c"));
		});

		test("that fails leaves the prompt trimmed, with the notice", async () => {
			const chat = await longChat({
				refused: true,
			});

			const sent = JSON.stringify(chat.bodies[3]?.messages);
			expect(sent).not.toContain(long("a"));
			expect(sent).toContain(long("c"));
			expect(textOf(partsOf(5, chat))).toEqual([
				"Three.",
			]);
			expect(chat.messages()[5]?.metadata.historyTrimmed).toBe(true);
		});
	});
});

describe("continueTurn", () => {
	test("applies the decisions under the chat's lock and runs the approved call", async () => {
		const chat = await pausedAssistant();
		chat.script([
			{
				text: "Deleted.",
			},
		]);

		await chat.decide(false);

		const reply = chat.messages().at(-1);
		expect(toolStates(reply?.parts ?? [])).toEqual([
			"output-denied",
		]);
		expect(textOf(reply?.parts ?? [])).toEqual([
			"Deleted.",
		]);
		expect(reply?.metadata.continuedAt).toBeUndefined();
		// The model read the denial it was stored with.
		expect(JSON.stringify(chat.bodies.at(-1))).toContain(
			"Tool call execution denied.",
		);
	});

	test("marks a continued reply whose stream was cut off", async () => {
		const chat = await pausedAssistant();
		chat.script([
			{
				text: "Deleted the",
				cutOff: true,
			},
		]);

		await chat.decide(true);

		const reply = chat.messages().at(-1);
		expect(textOf(reply?.parts ?? [])).toContain("Deleted the");
		expect(reply?.metadata.interrupted).toBe(true);
	});

	test("continues a reply stopped while a call ran beside an approval", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const stop = new AbortController();
		answers["bot.list"] = () =>
			Effect.sync(() => stop.abort()).pipe(Effect.andThen(Effect.never));
		chat.script([
			{
				calls: [
					{
						name: "findBots",
						input: {},
					},
					deleteDraft,
				],
			},
		]);
		await chat.send("Delete the old draft", stop.signal);
		expect(toolStates(chat.messages().at(-1)?.parts ?? [])).toEqual([
			"output-error",
			"approval-requested",
		]);
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					name: "Old draft",
					capabilities: {
						delete: true,
					},
				},
			});
		answers["bot.delete"] = () => Effect.succeed({});
		chat.script([
			{
				text: "Deleted.",
			},
		]);

		await chat.decide(true);

		const reply = chat.messages().at(-1);
		expect(toolStates(reply?.parts ?? [])).toEqual([
			"output-error",
			"output-available",
		]);
		expect(textOf(reply?.parts ?? [])).toEqual([
			"Deleted.",
		]);
		// The model read the stopped call as interrupted.
		expect(JSON.stringify(chat.bodies.at(-1))).toContain(
			TOOL_CLOSE_SENTENCES.interrupted,
		);
	});

	test("clears the cut-off mark of a paused reply once its continuation finishes", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				calls: [
					deleteDraft,
				],
				cutOff: true,
			},
		]);
		await chat.send("Delete the old draft");
		expect(toolStates(chat.messages().at(-1)?.parts ?? [])).toEqual([
			"approval-requested",
		]);
		expect(chat.messages().at(-1)?.metadata.interrupted).toBe(true);
		chat.script([
			{
				text: "Deleted.",
			},
		]);

		await chat.decide(true);

		expect(chat.messages().at(-1)?.metadata.interrupted).toBe(false);
	});

	test("clears why a paused reply stopped early once its continuation finishes", async () => {
		const chat = await pausedAssistant();
		// A step that asks for approval can also be the last one the turn had room or time for.
		Object.assign(chat.messages().at(-1)?.metadata ?? {}, {
			stepLimitReached: true,
			contextLimitReached: true,
			timeLimitReached: true,
		});
		chat.script([
			{
				text: "Deleted.",
			},
		]);

		await chat.decide(true);

		expect(chat.messages().at(-1)?.metadata).toMatchObject({
			stepLimitReached: false,
			contextLimitReached: false,
			timeLimitReached: false,
		});
	});

	test("keeps the approved plan in the instructions, and drops a proposal the user moved past", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const proposal = {
			name: "updatePlan",
			input: {
				title: "Support bot",
				items: [
					{
						label: "Create the bot",
						status: "pending",
					},
				],
			},
		};
		chat.script([
			{
				calls: [
					proposal,
				],
			},
			{
				text: "Sure.",
			},
			{
				calls: [
					proposal,
				],
			},
			{
				text: "Starting.",
			},
			{
				text: "Still on it.",
			},
		]);
		const planShown = () =>
			chat.bodies.map((body) =>
				JSON.stringify(body.system).includes('Title: \\"Support bot\\"'),
			);

		await chat.send("Make a support bot");
		await chat.send("Actually, what can you do?");
		await chat.send("Make a support bot");
		await chat.decide(true);
		await chat.send("How far are you?");

		expect(planShown()).toEqual([
			false,
			false,
			false,
			true,
			true,
		]);
	});

	test("refuses a reply that is no longer the last message", async () => {
		const chat = await pausedAssistant();
		const [, paused] = chat.messages();
		chat.script([
			{
				text: "Kept it.",
			},
		]);
		await chat.send("Keep it");

		expect(
			await refusal(() =>
				chat.run(
					chat.continue({
						...chat.requester,
						chatId: paused?.chatId ?? chatRow().id,
						replyId: paused?.id as ChatMessageId,
						decisions: [],
						toolOutputs: [],
						clientZedToken: undefined,
						stop: undefined,
					}),
				),
			),
		).toBe("ConflictError: CHAT_TURN_NOT_AWAITING");
	});

	test("refuses decisions that leave a pending call unanswered", async () => {
		const chat = await pausedAssistant();
		const paused = chat.messages().at(-1);

		expect(
			await refusal(() =>
				chat.run(
					chat.continue({
						...chat.requester,
						chatId: paused?.chatId ?? chatRow().id,
						replyId: paused?.id as ChatMessageId,
						decisions: [],
						toolOutputs: [],
						clientZedToken: undefined,
						stop: undefined,
					}),
				),
			),
		).toBe("BadRequestError: CHAT_TURN_DECISIONS_INCOMPLETE");
		expect(chat.messages().at(-1)).toEqual(paused);
	});

	test("stores nothing when the quota refuses a continuation", async () => {
		const chat = await pausedAssistant();
		const paused = chat.messages().at(-1);
		quota.reservation = {
			denial: "QUOTA_EXHAUSTED",
		};

		expect(await refusal(() => chat.decide(true))).toBe(
			"QuotaDeniedError: QUOTA_EXHAUSTED",
		);
		expect(chat.messages().at(-1)).toEqual(paused);
	});

	test("releases the quota of a continuation that finds nothing to answer", async () => {
		const chat = await pausedAssistant();
		chat.script([
			{
				text: "Kept it.",
			},
		]);
		await chat.send("Keep it");
		quota.reset();

		expect(await refusal(() => chat.decide(true))).toBe(
			"ConflictError: CHAT_TURN_NOT_AWAITING",
		);
		expect(quota.calls.settle).toEqual([
			expect.objectContaining({
				steps: [],
				reason: "app_failure",
			}),
		]);
	});

	test("refuses a plain chat, whose replies never wait", async () => {
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				text: "Hello.",
			},
		]);
		await chat.send("Hi");

		expect(await refusal(() => chat.decide(true))).toBe(
			"ConflictError: CHAT_TURN_NOT_AWAITING",
		);
	});
});

describe("turn writes", () => {
	const botId = crypto.randomUUID();
	const publish = {
		name: "publishBot",
		input: {
			id: botId,
		},
	};

	beforeEach(() => {
		answers["bot.publish"] = () =>
			Effect.succeed({
				data: {
					id: botId,
					name: "Tutor",
					description: null,
					status: "published",
					features: {},
					behaviour: null,
					repositories: [],
				},
			});
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					name: "Old draft",
					capabilities: {
						delete: true,
					},
				},
			});
		answers["bot.delete"] = () =>
			Effect.succeed({
				success: true,
			});
	});

	const streamedWrites = (chunks: unknown[]) =>
		chunks.flatMap((chunk) => {
			const { type, messageMetadata } = chunk as UIMessageChunk & {
				messageMetadata?: {
					writes?: unknown;
				};
			};

			return type === "message-metadata" && messageMetadata?.writes
				? [
						messageMetadata.writes,
					]
				: [];
		});

	test("a write before an approval pause stays with the reply, and its continuation adds its own", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				calls: [
					publish,
					deleteDraft,
				],
			},
		]);

		const paused = await chat.send(
			"Publish the tutor and delete the old draft",
		);

		expect(streamedWrites(paused)).toEqual([
			[
				{
					path: "bot.publish",
				},
			],
		]);
		expect(chat.messages().at(-1)?.metadata.writes).toEqual([
			{
				path: "bot.publish",
			},
		]);

		chat.script([
			{
				text: "Done.",
			},
		]);
		const continued = await chat.decide(true);

		const both: TurnWrite[] = [
			{
				path: "bot.publish",
			},
			{
				path: "bot.delete",
			},
		];
		expect(streamedWrites(continued)).toEqual([
			both,
		]);
		expect(chat.messages().at(-1)?.metadata.writes).toEqual(both);
	});

	test("a stopped turn keeps what it wrote before the stop", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const stop = new AbortController();
		chat.script([
			{
				calls: [
					publish,
				],
			},
			{
				text: "Never read.",
			},
		]);
		chat.beforeRequest((count) => {
			if (count === 2) {
				stop.abort();
			}
		});

		await chat.send("Publish the tutor", stop.signal);

		expect(chat.messages().at(-1)?.metadata.writes).toEqual([
			{
				path: "bot.publish",
			},
		]);
	});

	test("a change still running when the user stops is stored with the reply once it succeeds", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const stop = new AbortController();
		const published = answers["bot.publish"];
		answers["bot.publish"] = (input) =>
			Effect.promise(async () => {
				stop.abort();
				await new Promise((resolve) => setTimeout(resolve, 50));
			}).pipe(Effect.andThen(published?.(input) ?? Effect.void));
		chat.script([
			{
				calls: [
					publish,
				],
			},
			{
				text: "Never read.",
			},
		]);

		await chat.send("Publish the tutor", stop.signal);

		const reply = chat.messages().at(-1);
		expect(reply?.metadata.writes).toEqual([
			{
				path: "bot.publish",
			},
		]);
		expect(reply?.parts).toContainEqual(
			expect.objectContaining({
				type: "tool-publishBot",
				state: "output-available",
				output: expect.objectContaining({
					id: botId,
					status: "published",
				}),
			}),
		);
	});

	test("a create the user stops runs once to its end, and the reply ends with its result", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const stop = new AbortController();
		const published = answers["bot.publish"];
		answers["bot.save"] = (input) =>
			Effect.promise(async () => {
				stop.abort();
				await new Promise((resolve) => setTimeout(resolve, 50));
			}).pipe(Effect.andThen(published?.(input) ?? Effect.void));
		chat.script([
			{
				calls: [
					{
						name: "updatePlan",
						input: {
							title: "Support bot",
							items: [
								{
									label: "Create the bot",
									status: "pending",
								},
							],
						},
					},
				],
			},
			{
				calls: [
					{
						name: "createBot",
						input: {
							name: "Tutor",
							description: "Helps students.",
						},
					},
				],
			},
			{
				text: "Never read.",
			},
		]);
		await chat.send("Make a support bot");

		await chat.decide(true, stop.signal);

		const reply = chat.messages().at(-1);
		expect(
			procedureCalls.filter(({ procedure }) => procedure === "bot.save"),
		).toHaveLength(1);
		expect(reply?.parts).toContainEqual(
			expect.objectContaining({
				type: "tool-createBot",
				state: "output-available",
				output: expect.objectContaining({
					type: "bot",
					id: botId,
				}),
			}),
		);
		expect(chat.bodies).toHaveLength(2);
		expect(textOf(reply?.parts ?? [])).not.toContain("Never read.");
	});

	test("a read the user stops is interrupted", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const stop = new AbortController();
		const find = answers["bot.find"];
		answers["bot.find"] = (input) =>
			Effect.promise(async () => {
				stop.abort();
				await new Promise((resolve) => setTimeout(resolve, 50));
			}).pipe(Effect.andThen(find?.(input) ?? Effect.void));
		chat.script([
			{
				calls: [
					{
						name: "getBot",
						input: {
							id: botId,
						},
					},
				],
			},
			{
				text: "Never read.",
			},
		]);

		await chat.send("What is the tutor?", stop.signal);

		expect(chat.messages().at(-1)?.parts).toContainEqual(
			expect.objectContaining({
				type: "tool-getBot",
				state: "output-error",
				errorText: TOOL_CLOSE_SENTENCES.interrupted,
			}),
		);
	});

	/** A publish that stops the turn and ends only when `finish` is called; the wait for it ends only when `endWait` is. */
	const outlastingPublish = () => {
		const stop = new AbortController();
		const late = Promise.withResolvers<void>();
		const waiting = Promise.withResolvers<void>();
		const bound = new AbortController();
		turnWaits.runningCalls = () => {
			waiting.resolve();
			return bound.signal;
		};
		const published = answers["bot.publish"];
		answers["bot.publish"] = (input) =>
			Effect.promise(async () => {
				stop.abort();
				await late.promise;
			}).pipe(Effect.andThen(published?.(input) ?? Effect.void));

		return {
			stop: stop.signal,
			waiting: waiting.promise,
			endWait: () => bound.abort(),
			finish: async () => {
				late.resolve();
				await new Promise((resolve) => setTimeout(resolve, 20));
			},
			restore: () => {
				turnWaits.runningCalls = undefined;
			},
		};
	};

	test("a change that outlasts the wait leaves the reply settled once, without its write", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const publishing = outlastingPublish();
		chat.script([
			{
				calls: [
					publish,
				],
			},
			{
				text: "Never read.",
			},
		]);

		try {
			const sent = chat.send("Publish the tutor", publishing.stop);
			await publishing.waiting;
			publishing.endWait();
			await sent;
			const settled = chat.messages().at(-1);
			await publishing.finish();

			expect(settled?.metadata.writes).toBeUndefined();
			expect(settled?.parts).toContainEqual(
				expect.objectContaining({
					type: "tool-publishBot",
					state: "output-error",
					errorText: TOOL_CLOSE_SENTENCES.interrupted,
				}),
			);
			expect(chat.messages().at(-1)).toEqual(settled);
		} finally {
			publishing.restore();
		}
	});

	test("a continuation sent while a stopped turn waits is refused, and the reply settles with the write", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		const publishing = outlastingPublish();
		chat.script([
			{
				calls: [
					publish,
					deleteDraft,
				],
			},
		]);

		try {
			const sent = chat.send(
				"Publish the tutor and delete the draft",
				publishing.stop,
			);
			await publishing.waiting;
			const replyId = chat.messages().at(-1)?.id as ChatMessageId;
			const early = await refusal(() =>
				chat.run(
					chat.continue({
						...chat.requester,
						chatId: chat.chatId,
						replyId,
						decisions: [],
						toolOutputs: [],
						clientZedToken: undefined,
						stop: undefined,
					}),
				),
			);
			await publishing.finish();
			await sent;

			expect(early).toBe("ConflictError: CHAT_TURN_NOT_AWAITING");
			expect(chat.messages().at(-1)?.metadata.writes).toEqual([
				{
					path: "bot.publish",
				},
			]);
		} finally {
			publishing.restore();
		}
	});

	test("a turn that only reads lists no writes", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				calls: [
					{
						name: "getBot",
						input: {
							id: botId,
						},
					},
				],
			},
			{
				text: "It is a draft.",
			},
		]);

		const chunks = await chat.send("What is the tutor?");

		expect(streamedWrites(chunks)).toEqual([]);
		expect(chat.messages().at(-1)?.metadata.writes).toBeUndefined();
	});
});

describe("turn setup", () => {
	const refusalOf = async (chat: Parameters<typeof conversation>[0]) => {
		const turns = await conversation(chat, "anthropic");
		return refusal(() => turns.send("Hi"));
	};

	test("refuses a chat that does not exist", async () => {
		const turns = await conversation(chatRow(), "anthropic");
		const store = memoryReplyStore([]);

		expect(
			await refusal(() =>
				runTurn(
					turns.start({
						...turns.requester,
						chatId: chatRow().id,
						message: {
							id: crypto.randomUUID() as ChatMessageId,
							role: "user",
							attachments: [],
							parts: [],
						},
						stop: undefined,
					}),
					store.layer,
				),
			),
		).toBe("NotFoundError: CHAT_NOT_FOUND");
	});

	test("refuses an assistant conversation of another organisation", async () => {
		expect(
			await refusalOf({
				...assistantRow(),
				organizationId: crypto.randomUUID() as typeof ORGANIZATION_ID,
			}),
		).toBe("BadRequestError: CHAT_ORGANIZATION_MISMATCH");
	});

	test("refuses a chat without a model when the organisation has none", async () => {
		answers["chat.defaultModel"] = () =>
			Effect.succeed({
				data: null,
			});
		expect(
			await refusalOf(
				chatRow({
					config: {} as never,
				}),
			),
		).toBe("BadRequestError: CHAT_MODEL_NOT_CONFIGURED");
	});

	test("refuses the assistant when the organisation has no model", async () => {
		const { answers } = await import("../tools/assistant/test-procedures");
		answers["organization.find"] = () =>
			Effect.succeed({
				data: {
					id: ORGANIZATION_ID,
					name: "Org",
					assistantModelId: null,
				},
			});

		expect(await refusalOf(assistantRow())).toBe(
			"BadRequestError: ASSISTANT_MODEL_NOT_CONFIGURED",
		);
	});

	test("refuses a model of another provider than the chat names", async () => {
		expect(
			await refusalOf(
				chatRow({
					config: {
						...chatRow().config,
						providerId: crypto.randomUUID(),
					} as never,
				}),
			),
		).toBe("BadRequestError: MODEL_PROVIDER_MISMATCH");
	});

	test("refuses a model that cannot carry a turn", async () => {
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			model: {
				capabilities: [],
			},
		});

		expect(await refusalOf(chatRow())).toBe(
			"BadRequestError: MODEL_TOOLS_UNSUPPORTED",
		);
	});

	test("a refused read stays a denial and an outage stays unavailable, as the procedure answered", async () => {
		const botId = crypto.randomUUID() as BotId;
		answers["bot.findContents"] = () =>
			Effect.succeed({
				data: {
					behaviour: {
						id: crypto.randomUUID(),
						type: "behaviour",
						config: {
							systemPrompt: "You are the bot.",
						},
					},
					repositories: [],
				},
			});
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					id: botId,
					features: {},
				},
			});
		const answered = async (
			procedure: string,
			error: ORPCError<string, unknown>,
		) => {
			const previous = answers[procedure];
			answers[procedure] = () => Effect.fail(error);
			const turns = await conversation(
				chatRow({
					botId,
				}),
				"anthropic",
			);
			const outcome = await turns.send("Hi").then(
				() => "ok",
				(failure: unknown) =>
					failure instanceof ORPCError
						? `${failure.code} ${failure.data?.reason}`
						: String(failure),
			);
			if (previous) answers[procedure] = previous;
			else delete answers[procedure];
			return outcome;
		};

		expect(
			await answered(
				"bot.find",
				new ORPCError("FORBIDDEN", {
					data: {
						reason: "PERMISSION_DENIED",
					},
				}),
			),
		).toBe("FORBIDDEN PERMISSION_DENIED");
		expect(
			await answered(
				"chatBlock.list",
				new ORPCError("SERVICE_UNAVAILABLE", {
					data: {
						reason: "PERMISSIONS_UNAVAILABLE",
					},
				}),
			),
		).toBe("SERVICE_UNAVAILABLE PERMISSIONS_UNAVAILABLE");
	});

	test("estimates a chat's prompt with only the tools it offers", async () => {
		const estimate = async (chatBlocks: unknown[]) => {
			answerSetup({
				providerKind: "anthropic",
				providerModelId: "claude-opus-5-5",
				chatBlocks,
			});
			const chat = await conversation(chatRow(), "anthropic");
			chat.script([
				{
					text: "Hello.",
				},
			]);
			await chat.send("Hi");
			return chat.messages().at(-1)?.metadata.contextEstimate ?? 0;
		};

		const plain = await estimate([]);
		const withRepository = await estimate([
			{
				id: crypto.randomUUID(),
				type: "repository",
				name: "Handbook",
				config: {},
			},
		]);

		expect(plain).toBeGreaterThan(0);
		// The repository tools and their guidance, which a plain chat does not send.
		expect(withRepository - plain).toBeGreaterThan(1_000);
	});

	describe("chat tools", () => {
		const SEARCH_PROVIDER_ID = "00000000-0000-4000-8000-0000000000ee";
		const repository = {
			id: crypto.randomUUID(),
			type: "repository",
			name: "Handbook",
			config: {},
		};

		/** The tools of a bot chat's first request, with the organisation's web search setting. */
		const botTools = async ({
			features,
			repositories = [],
			webSearchMode = "off",
		}: {
			features: Record<string, unknown>;
			repositories?: unknown[];
			webSearchMode?: "off" | "native" | "provider";
		}) => {
			const botId = crypto.randomUUID() as BotId;
			answers["bot.findContents"] = () =>
				Effect.succeed({
					data: {
						behaviour: {
							id: crypto.randomUUID(),
							type: "behaviour",
							config: {
								systemPrompt: "You are the bot.",
							},
						},
						repositories: repositories,
					},
				});
			answers["bot.find"] = () =>
				Effect.succeed({
					data: {
						id: botId,
						features,
					},
				});
			const organization = answers["organization.find"];
			answers["organization.find"] = (input) =>
				(organization?.(input) ?? Effect.die("no organization")).pipe(
					Effect.map((answer) => ({
						data: {
							...(
								answer as {
									data: object;
								}
							).data,
							webSearchMode,
							webSearchProviderId: SEARCH_PROVIDER_ID,
						},
					})),
				);
			const provider = answers["provider.find"];
			answers["provider.find"] = (input: { id: string }) =>
				input.id === SEARCH_PROVIDER_ID
					? Effect.succeed({
							data: {
								id: SEARCH_PROVIDER_ID,
								kind: "tavily",
								enabled: true,
								endpoint: null,
							},
						})
					: (provider?.(input as never) ?? Effect.die("no provider"));
			const chat = await conversation(
				chatRow({
					botId,
				}),
				"anthropic",
			);
			chat.script([
				{
					text: "Hello.",
				},
			]);
			await chat.send("Hi");
			return chat.bodies[0]?.tools as
				| {
						name: string;
						type?: string;
						description?: string;
						allowed_domains?: string[];
				  }[]
				| undefined;
		};
		const namesOf = (
			tools:
				| {
						name: string;
				  }[]
				| undefined,
		) => tools?.map(({ name }) => name);

		const REPOSITORY_TOOLS = [
			"searchRepositories",
			"listRepositoryAssets",
			"getAssetPage",
			"getPassages",
		];
		const QUESTION_TOOLS = [
			"askUser",
			"showQuizResult",
		];

		test("sends the repository tools first, then the features' tools in catalogue order", async () => {
			const tools = await botTools({
				features: {
					questions: {},
					webSearch: {
						allowedDomains: [
							"example.org",
						],
					},
					generativeUi: {},
				},
				repositories: [
					repository,
				],
				webSearchMode: "provider",
			});

			const names = namesOf(tools) ?? [];
			expect(names.slice(0, 4)).toEqual(REPOSITORY_TOOLS);
			expect(names.slice(-3)).toEqual([
				"searchWeb",
				...QUESTION_TOOLS,
			]);
			expect(names.length).toBeGreaterThan(7);
			expect(
				tools?.find(({ name }) => name === "searchWeb")?.description,
			).toContain("Only pages on example.org and their subdomains");
		});

		test("sends the model's own search within the allowed domains", async () => {
			const tools = await botTools({
				features: {
					webSearch: {
						allowedDomains: [
							"example.org",
						],
					},
				},
				webSearchMode: "native",
			});

			expect(tools).toEqual([
				expect.objectContaining({
					name: "web_search",
					type: expect.stringMatching(/^web_search_/),
					allowed_domains: [
						"example.org",
					],
				}),
			]);
		});

		test("leaves out a feature whose settings no longer parse or whose search is off", async () => {
			expect(
				namesOf(
					await botTools({
						features: {
							webSearch: {
								allowedDomains: "example.org",
							},
							questions: {},
						},
						webSearchMode: "native",
					}),
				),
			).toEqual(QUESTION_TOOLS);
			expect(
				namesOf(
					await botTools({
						features: {
							webSearch: {},
							questions: {},
						},
						webSearchMode: "off",
					}),
				),
			).toEqual(QUESTION_TOOLS);
		});

		test("sends no tools when the chat offers none", async () => {
			const chat = await conversation(chatRow(), "anthropic");
			chat.script([
				{
					text: "Hello.",
				},
			]);
			await chat.send("Hi");

			expect(chat.bodies[0]).not.toHaveProperty("tools");
			expect(chat.bodies[0]).not.toHaveProperty("tool_choice");
			expect(
				await botTools({
					features: {},
				}),
			).toBeUndefined();
		});
	});

	describe("citations", () => {
		const repositoryChat = async () => {
			answerSetup({
				providerKind: "anthropic",
				providerModelId: "claude-opus-5-5",
				chatBlocks: [
					{
						id: crypto.randomUUID(),
						type: "repository",
						name: "Handbook",
						config: {},
					},
				],
			});
			answers["block.readiness"] = () =>
				Effect.succeed({
					data: [],
				});
			answers["assetPoint.searchRepositories"] = () =>
				Effect.succeed({
					results: [
						{
							data: [
								assetPoint({
									id: "c1",
									index: 1,
									text: "Refunds are paid within 14 days.",
									pageStart: 4,
								}),
							],
						},
					],
				});
			return await conversation(chatRow(), "anthropic");
		};
		const ref = sourceRef("passage", "c1");
		const refund = {
			kind: "asset" as const,
			assetId: "asset-a",
			title: "Refund policy",
			page: 4,
		};
		const searched = {
			calls: [
				{
					name: "searchRepositories",
					input: {
						query: "refunds",
					},
				},
			],
		};
		const metadataChunks = (chunks: unknown[]) =>
			chunks.flatMap((chunk) => {
				const { type, messageMetadata } = chunk as {
					type: string;
					messageMetadata?: {
						citations?: unknown;
					};
				};
				return type === "message-metadata" || type === "finish"
					? [
							{
								type,
								citations: messageMetadata?.citations,
							},
						]
					: [];
			});

		const toolParts = (chat: Awaited<ReturnType<typeof repositoryChat>>) =>
			(chat.messages().at(-1)?.parts ?? []).filter(
				(part) =>
					typeof part === "object" && part !== null && "toolCallId" in part,
			);

		test("repairs a malformed repository call within its schema's limits", async () => {
			const chat = await repositoryChat();
			chat.script([
				{
					calls: [
						{
							name: "searchRepositories",
							input: {
								query: "refunds",
								queryVariants: [
									"refund time",
									"payout",
									"money back",
									"reimbursement",
									"repayment",
								],
								scope: "all",
							},
						},
					],
				},
				{
					text: "Within 14 days.",
				},
			]);

			await chat.send("How fast are refunds paid?");

			expect(toolParts(chat)).toEqual([
				expect.objectContaining({
					state: "output-available",
					input: {
						query: "refunds",
						queryVariants: [
							"refund time",
							"payout",
							"money back",
							"reimbursement",
						],
					},
				}),
			]);
		});

		test("a call still invalid after repair fails as a tool error without searching", async () => {
			const chat = await repositoryChat();
			chat.script([
				{
					calls: [
						{
							name: "searchRepositories",
							input: {
								query: "r",
								scope: "all",
							},
						},
					],
				},
				{
					text: "I could not search.",
				},
			]);

			await chat.send("How fast are refunds paid?");

			expect(toolParts(chat)).toEqual([
				expect.objectContaining({
					state: "output-error",
					errorText: expect.stringContaining("Invalid input"),
				}),
			]);
			expect(
				procedureCalls.some(
					({ procedure }) => procedure === "assetPoint.searchRepositories",
				),
			).toBe(false);
		});

		test("stores the sources of the refs the reply cites", async () => {
			const chat = await repositoryChat();
			chat.script([
				searched,
				{
					text: `Paid <cite ref=${ref}>within 14 days</cite>, as <cite ref=k000000>promised</cite>.`,
				},
			]);

			await chat.send("How fast are refunds paid?");

			expect(JSON.stringify(chat.bodies[1]?.messages)).toContain(
				`<passage ref=${ref} asset=\\"Refund policy\\" pages=\\"4\\">\\nRefunds are paid within 14 days.\\n</passage>`,
			);
			expect(chat.messages().at(-1)?.metadata.citations).toEqual({
				[ref]: refund,
			});
		});

		test("streams a citation once its tag is written, before the reply finishes", async () => {
			const chat = await repositoryChat();
			chat.script([
				searched,
				{
					text: `Paid <cite ref="${ref}">within 14 days</cite>.`,
				},
			]);

			const chunks = await chat.send("How fast are refunds paid?");
			const metadata = metadataChunks(chunks);
			const streamed = metadata.findIndex(
				({ type, citations }) =>
					type === "message-metadata" && citations !== undefined,
			);

			expect(metadata[streamed]?.citations).toEqual({
				[ref]: refund,
			});
			expect(streamed).toBeLessThan(
				metadata.findIndex(({ type }) => type === "finish"),
			);
		});

		test("a follow-up cites a source of an earlier turn without searching again", async () => {
			const chat = await repositoryChat();
			chat.script([
				searched,
				{
					text: "Refunds are paid within 14 days.",
				},
			]);
			await chat.send("How fast are refunds paid?");
			chat.script([
				{
					text: `As I said, <cite ref=${ref}>within 14 days</cite>.`,
				},
			]);

			const chunks = await chat.send("Say it again with the source.");

			expect(
				metadataChunks(chunks).find(
					({ type, citations }) =>
						type === "message-metadata" && citations !== undefined,
				)?.citations,
			).toEqual({
				[ref]: refund,
			});
			expect(chat.messages().at(-1)?.metadata.citations).toEqual({
				[ref]: refund,
			});
		});

		/** The reply as the client builds it from the stream, from `message` on when it continues one. */
		const clientCitations = async (chunks: unknown[], message?: UIMessage) => {
			let reply: UIMessage | undefined;
			for await (const built of readUIMessageStream({
				message,
				stream: simulateReadableStream({
					chunks: chunks as UIMessageChunk[],
					initialDelayInMs: null,
					chunkDelayInMs: null,
				}),
			})) {
				reply = built;
			}
			return (
				reply?.metadata as
					| {
							citations?: Record<string, unknown>;
					  }
					| undefined
			)?.citations;
		};

		test("withdraws a streamed citation once a later call makes its ref ambiguous", async () => {
			const chat = await repositoryChat();
			// Two point ids whose refs collide.
			const [first, second] = [
				"https://example.com/3f49a11da1fabbf4",
				"https://example.com/f0afd2db51eaec07",
			];
			const shared = sourceRef("passage", first);
			expect(sourceRef("passage", second)).toBe(shared);
			let searches = 0;
			answers["assetPoint.searchRepositories"] = () => {
				searches += 1;
				return Effect.succeed({
					results: [
						{
							data: [
								assetPoint({
									id: searches === 1 ? first : second,
									index: searches,
									pageStart: 4,
								}),
							],
						},
					],
				});
			};
			chat.script([
				searched,
				{
					text: `Paid <cite ref=${shared}>within 14 days</cite>.`,
					calls: [
						{
							name: "searchRepositories",
							input: {
								query: "more refunds",
							},
						},
					],
				},
				{
					text: "Done.",
				},
			]);

			const chunks = await chat.send("How fast are refunds paid?");
			const streamed = metadataChunks(chunks).filter(
				({ citations }) => citations !== undefined,
			);

			expect(streamed.at(0)?.citations).toEqual({
				[shared]: refund,
			});
			expect((await clientCitations(chunks))?.[shared]).toBeNull();
			expect(chat.messages().at(-1)?.metadata.citations).toBeUndefined();
		});

		test("a continued reply keeps only the citations the chat still resolves", async () => {
			const chat = await pausedAssistant();
			const paused = chat.messages().at(-1);
			if (!paused) {
				throw new Error("no paused reply");
			}
			paused.metadata.citations = {
				[ref]: refund,
			};
			paused.parts.push({
				type: "text",
				text: `Earlier <cite ref=${ref}>text</cite>.`,
			} as (typeof paused.parts)[number]);
			chat.script([
				{
					text: "Done.",
				},
			]);

			const client = {
				id: paused.id,
				role: "assistant",
				parts: paused.parts,
				metadata: paused.metadata,
			} as UIMessage;

			const chunks = await chat.decide(false);

			expect(chat.messages().at(-1)?.metadata.citations).toBeUndefined();
			expect((await clientCitations(chunks, client))?.[ref]).toBeNull();
		});
	});

	test("meters a bot chat's turn with its bot", async () => {
		const botId = crypto.randomUUID() as BotId;
		answers["bot.findContents"] = () =>
			Effect.succeed({
				data: {
					behaviour: {
						id: crypto.randomUUID(),
						type: "behaviour",
						config: {
							systemPrompt: "You are the bot.",
						},
					},
					repositories: [],
				},
			});
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					id: botId,
					features: {},
				},
			});
		const chat = await conversation(
			chatRow({
				botId,
			}),
			"anthropic",
		);
		chat.script([
			{
				text: "Hello.",
			},
		]);

		await chat.send("Hi");

		expect(quota.calls.reserve).toEqual([
			expect.objectContaining({
				botId,
			}),
		]);
	});

	test("prefers an attached behaviour's prompt over the chat's own", async () => {
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			chatBlocks: [
				{
					id: crypto.randomUUID(),
					type: "behaviour",
					config: {
						systemPrompt: "You are the behaviour.",
					},
				},
			],
		});
		const chat = await conversation(
			chatRow({
				config: {
					...chatRow().config,
					systemPrompt: "You are the chat.",
				} as never,
			}),
			"anthropic",
		);
		chat.script([
			{
				text: "Hello.",
			},
		]);

		await chat.send("Hi");

		const system = JSON.stringify(chat.bodies[0]?.system);
		expect(system).toContain("You are the behaviour.");
		expect(system).not.toContain("You are the chat.");
	});
});

describe("keepUploads", () => {
	const apa = {
		id: crypto.randomUUID() as AssetId,
		title: "APA 7.pdf",
	};

	/** An assistant conversation whose reply waits for an upload. */
	const waitingUpload = async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				calls: [
					{
						name: "requestUpload",
						input: {
							reason: "Upload the style guide.",
						},
					},
				],
			},
		]);
		await chat.send("Make a bot from my style guide");
		const reply = chat.messages().at(-1);
		const call = toChatAgentParts(reply?.parts ?? []).find(
			(part) => part.type === "tool-requestUpload",
		);
		const keep = (toolCallId = call?.toolCallId ?? "") =>
			chat.run(
				keepUploads({
					...chat.requester,
					chatId: chat.chatId,
					replyId: reply?.id as ChatMessageId,
					toolCallId,
					kept: {
						assets: [
							apa,
						],
						zedToken: "zed-upload",
					},
				}),
			);
		return {
			chat,
			toolCallId: call?.toolCallId ?? "",
			keep,
		};
	};

	test("keeps what a waiting upload lists with the reply until the call is answered", async () => {
		const { chat, toolCallId, keep } = await waitingUpload();

		expect(await keep()).toEqual({
			assets: [
				apa,
			],
			zedToken: "zed-upload",
		});
		expect(chat.messages().at(-1)?.metadata.uploads).toEqual({
			[toolCallId]: {
				assets: [
					apa,
				],
				zedToken: "zed-upload",
			},
		});

		chat.script([
			{
				text: "Got it.",
			},
		]);
		await chat.answer([
			{
				toolCallId,
				output: {
					status: "saved",
					assets: [
						apa,
					],
				},
			},
		]);

		expect(chat.messages().at(-1)?.metadata.uploads).toBeUndefined();
		expect(await refusal(() => keep())).toBe(
			"ConflictError: CHAT_TURN_NOT_AWAITING",
		);
	});

	test("refuses a call that is not a waiting upload", async () => {
		const { chat, keep } = await waitingUpload();
		const paused = chat.messages().at(-1);

		expect(await refusal(() => keep("other-call"))).toBe(
			"ConflictError: CHAT_TURN_NOT_AWAITING",
		);
		expect(chat.messages().at(-1)).toEqual(paused);
	});

	test("refuses a conversation of another organisation", async () => {
		const { chat, toolCallId } = await waitingUpload();
		const reply = chat.messages().at(-1);

		expect(
			await refusal(() =>
				chat.run(
					keepUploads({
						...chat.requester,
						organizationId: crypto.randomUUID() as typeof ORGANIZATION_ID,
						chatId: chat.chatId,
						replyId: reply?.id as ChatMessageId,
						toolCallId,
						kept: {
							assets: [],
						},
					}),
				),
			),
		).toBe("BadRequestError: CHAT_ORGANIZATION_MISMATCH");
		expect(chat.messages().at(-1)).toEqual(reply);
	});
});
