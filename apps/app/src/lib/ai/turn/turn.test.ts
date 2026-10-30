import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { BotId, ChatMessageId } from "@orcai/core";
import { METERED_CALL_TIMEOUT_MS } from "@orcai/quota";
import { quota } from "@orcai/quota/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { answers, resetProcedures } from "../tools/assistant/test-procedures";
import { chunkRef } from "../tools/rag/chunk-ref";
import { assetPoint } from "../tools/rag/test-points";
import {
	answerSetup,
	assistantRow,
	chatRow,
	conversation,
	drain,
	ORGANIZATION_ID,
	runTurn,
} from "./test-turn";

const { ReplyStore } = await import("./reply-store");
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
		expect(quota.calls.finalize).toHaveLength(1);
		expect(quota.calls.finalize[0]?.steps).toHaveLength(1);
		expect(quota.calls.release).toEqual([]);
	});

	test("charges a stopped turn the tokens of its finished steps", async () => {
		quota.pool = {
			meteringMode: "tokens",
			remaining: 100_000,
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

		expect(quota.calls.finalize).toHaveLength(1);
		expect(quota.calls.finalize[0]?.steps).toMatchObject([
			{
				totalTokens: 2,
			},
		]);
		expect(chat.messages().at(-1)?.metadata.timeLimitReached).toBeUndefined();
	});

	test("ends a turn that runs out of time like a stopped one, and says so", async () => {
		quota.pool = {
			meteringMode: "tokens",
			remaining: 100_000,
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
		const timeLimit = new AbortController();
		const timeout = AbortSignal.timeout;
		const timer = spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
			ms === METERED_CALL_TIMEOUT_MS ? timeLimit.signal : timeout(ms),
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
				timeLimit.abort();
			}
		});

		try {
			await chat.send("Write it");
		} finally {
			timer.mockRestore();
		}

		expect(quota.calls.finalize).toHaveLength(1);
		expect(quota.calls.finalize[0]?.steps).toHaveLength(1);
		expect(chat.messages().at(-1)?.metadata.timeLimitReached).toBe(true);
	});

	test("leaves no reply when the turn produced nothing, and releases its quota", async () => {
		const chat = await conversation(chatRow(), "anthropic");

		await chat.send("Hi");

		expect(chat.messages().map((message) => message.role)).toEqual([
			"user",
		]);
		expect(quota.calls.release).toEqual([
			expect.objectContaining({
				reason: "provider_failure",
			}),
		]);
	});

	test("stores nothing when the quota refuses the turn", async () => {
		quota.pool = {
			denial: "exhausted",
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
		expect(quota.calls.release).toEqual([
			expect.objectContaining({
				reason: "app_failure",
			}),
		]);
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

		expect(quota.calls.finalize).toHaveLength(1);
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
		expect(quota.calls.reserve[0]?.maxExpectedOutputTokens).toBe(4_000);
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

		const metered = JSON.stringify(quota.calls.reserve.at(-1)?.messages);
		expect(metered).not.toContain(long("a"));
		expect(metered).toContain(long("c"));
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
		expect(quota.calls.reserve.at(-1)?.maxExpectedOutputTokens).toBe(16_384);
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
		quota.pool = {
			denial: "exhausted",
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
		expect(quota.calls.release).toEqual([
			expect.objectContaining({
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

	test("refuses a chat without a model", async () => {
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
				type: "database",
				name: "Handbook",
				config: {},
			},
		]);

		expect(plain).toBeGreaterThan(0);
		// The knowledge base tools and their guidance, which a plain chat does not send.
		expect(withRepository - plain).toBeGreaterThan(1_000);
	});

	test("stores the sources of the chunk refs the reply cites", async () => {
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			chatBlocks: [
				{
					id: crypto.randomUUID(),
					type: "database",
					name: "Handbook",
					config: {},
				},
			],
		});
		answers["block.readiness"] = () =>
			Effect.succeed({
				data: [],
			});
		answers["assetPoint.searchRepository"] = () =>
			Effect.succeed({
				data: [
					assetPoint({
						id: "c1",
						index: 1,
						text: "Refunds are paid within 14 days.",
						pageStart: 4,
					}),
				],
			});
		const ref = chunkRef("c1");
		const chat = await conversation(chatRow(), "anthropic");
		chat.script([
			{
				calls: [
					{
						name: "searchKnowledgeBase",
						input: {
							query: "refunds",
						},
					},
				],
			},
			{
				text: `Paid <cite chunk="${ref}">within 14 days</cite>, as <cite chunk="k000000">promised</cite>.`,
			},
		]);

		await chat.send("How fast are refunds paid?");

		expect(JSON.stringify(chat.bodies[1]?.messages)).toContain(
			`<passage ref=\\"${ref}\\" asset=\\"Refund policy\\" pages=\\"4\\">\\nRefunds are paid within 14 days.\\n</passage>`,
		);
		expect(chat.messages().at(-1)?.metadata.citations).toEqual({
			[ref]: {
				assetId: "asset-a",
				title: "Refund policy",
				page: 4,
			},
		});
	});

	test("meters a bot chat's turn with its bot", async () => {
		const botId = crypto.randomUUID() as BotId;
		answers["block.list"] = () =>
			Effect.succeed({
				data: [
					{
						id: crypto.randomUUID(),
						type: "template",
						config: {
							systemPrompt: "You are the bot.",
						},
					},
				],
			});
		answers["bot.find"] = () =>
			Effect.succeed({
				data: {
					id: botId,
					features: {},
					capabilities: {
						use: true,
					},
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

	test("prefers an attached template's prompt over the chat's own", async () => {
		answerSetup({
			providerKind: "anthropic",
			providerModelId: "claude-opus-5-5",
			chatBlocks: [
				{
					id: crypto.randomUUID(),
					type: "template",
					config: {
						systemPrompt: "You are the template.",
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
		expect(system).toContain("You are the template.");
		expect(system).not.toContain("You are the chat.");
	});
});
