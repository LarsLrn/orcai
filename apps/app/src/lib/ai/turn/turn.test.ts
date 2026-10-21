import { beforeEach, describe, expect, test } from "bun:test";
import type { ChatMessageId } from "@orcai/core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { quota } from "../metered-call/test-quota";
import { resetProcedures } from "../tools/assistant/test-procedures";
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
		expect(quota.calls.finalize).toEqual([
			expect.objectContaining({
				actualRequestCount: 1,
			}),
		]);
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

		expect(quota.calls.finalize).toEqual([
			expect.objectContaining({
				actualRequestCount: 1,
				totalTokens: 2,
			}),
		]);
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
			"BadRequestError: QUOTA_EXHAUSTED",
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
			"BadRequestError: QUOTA_EXHAUSTED",
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
		).toBe("BadRequestError: ASSISTANT_ORGANIZATION_MISMATCH");
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
