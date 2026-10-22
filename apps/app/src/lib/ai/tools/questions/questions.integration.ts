import { beforeEach, describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ClientToolOutput } from "@orcai/schema";
import { createUser, integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { scriptedFetch } from "../../agents/test-provider";
import { quota } from "../../metered-call/test-quota";
import {
	answerSetup,
	chatRow,
	drain,
	requester,
	runTurn,
} from "../../turn/test-turn";
import { TOOL_CLOSE_SENTENCES } from "../../utils/close-pending-tool-parts";
import { answers, resetProcedures } from "../assistant/test-procedures";
import { capitalsAnswers, capitalsQuiz } from "./fixtures";

const { startTurn, continueTurn } = await import("../../turn/turn");
const { ReplyStore } = await import("../../turn/reply-store");
const { DrizzleReplyStore } = await import("../../turn/drizzle-reply-store");

const runtime = integrationRuntime();
// The store holds the runtime's DB; the turn's own services stay the fakes.
const store = Layer.succeed(
	ReplyStore,
	await runtime.runPromise(
		Effect.gen(function* () {
			return yield* ReplyStore;
		}).pipe(Effect.provide(DrizzleReplyStore)),
	),
);

/** A bot chat with the questions feature, stored in Postgres; turns run against a scripted model. */
const quizChat = async () => {
	const chatId = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [bot] = yield* db
				.insert(dbSchema.bot)
				.values({
					name: `Quiz bot ${crypto.randomUUID()}`,
					description: "Integration bot",
					contentHtml: "",
					userId: user.id,
					features: {
						questions: {},
					},
				})
				.returning();
			answers["bot.find"] = () =>
				Effect.succeed({
					data: bot,
				});
			const [chat] = yield* db
				.insert(dbSchema.chat)
				.values({
					title: "Quiz",
					userId: user.id,
					botId: bot.id,
					config: chatRow().config,
				})
				.returning();
			return chat.id as ChatId;
		}),
	);
	const provider = scriptedFetch("anthropic");
	globalThis.fetch = provider.fetch;
	const stored = async () =>
		(
			await runtime.runPromise(
				Effect.gen(function* () {
					return yield* (yield* ReplyStore).load(chatId);
				}).pipe(Effect.provide(store)),
			)
		)?.messages ?? [];

	return {
		script: provider.script,
		bodies: provider.bodies,
		stored,
		send: async (text: string) =>
			drain(
				await runTurn(
					startTurn({
						...requester,
						chatId,
						message: {
							id: crypto.randomUUID() as ChatMessageId,
							role: "user",
							attachments: [],
							parts: [
								{
									type: "text",
									text,
								},
							],
						},
						stop: undefined,
					}),
					store,
				),
			),
		answer: async (toolOutputs: ClientToolOutput[]) => {
			const reply = (await stored()).at(-1);
			return drain(
				await runTurn(
					continueTurn({
						...requester,
						chatId,
						replyId: reply?.id as ChatMessageId,
						decisions: [],
						toolOutputs,
						clientZedToken: undefined,
						stop: undefined,
					}),
					store,
				),
			);
		},
	};
};

const askUserPart = (
	message:
		| {
				parts: unknown[];
		  }
		| undefined,
) =>
	message?.parts.find(
		(part): part is Record<string, unknown> =>
			typeof part === "object" &&
			part !== null &&
			"type" in part &&
			part.type === "tool-askUser",
	);

beforeEach(() => {
	resetProcedures();
	quota.reset();
	answerSetup({
		providerKind: "anthropic",
		providerModelId: "claude-opus-5-5",
		chatBlocks: [],
	});
	answers["block.list"] = () =>
		Effect.succeed({
			data: [
				{
					id: crypto.randomUUID(),
					type: "template",
					config: {
						systemPrompt: "You quiz the user.",
					},
				},
			],
		});
});

/** A chat whose stored reply asks the capitals quiz and waits. */
const askedQuiz = async () => {
	const chat = await quizChat();
	chat.script([
		{
			text: "Here is your quiz.",
			calls: [
				{
					name: "askUser",
					input: capitalsQuiz,
				},
			],
		},
	]);
	await chat.send("Quiz me on capitals");
	return chat;
};

describe("questions on the reply store", () => {
	test(
		"a paused quiz is stored waiting, then answered and graded in the same reply",
		async () => {
			const chat = await askedQuiz();
			const [, paused] = await chat.stored();
			const call = askUserPart(paused);
			expect(call).toMatchObject({
				state: "input-available",
				input: capitalsQuiz,
			});

			chat.script([
				{
					calls: [
						{
							name: "showQuizResult",
							input: {
								results: [
									{
										question: 1,
										verdict: "correct",
									},
									{
										question: 2,
										verdict: "partly_correct",
										earned: 1,
									},
									{
										question: 3,
										verdict: "incorrect",
									},
								],
							},
						},
					],
				},
				{
					text: "Two of four.",
				},
			]);
			await chat.answer([
				{
					toolCallId: String(call?.toolCallId),
					output: capitalsAnswers,
				},
			]);

			const messages = await chat.stored();
			expect(messages).toHaveLength(2);
			const reply = messages[1];
			expect(reply?.id).toBe(paused?.id);
			expect(askUserPart(reply)).toMatchObject({
				state: "output-available",
				output: capitalsAnswers,
			});
			expect(
				reply?.parts.find(
					(part) =>
						typeof part === "object" &&
						part !== null &&
						"type" in part &&
						part.type === "tool-showQuizResult",
				),
			).toMatchObject({
				state: "output-available",
				output: {
					earned: 2,
					points: 4,
				},
			});
			expect(reply?.metadata.continuedAt).toBeUndefined();
		},
		{
			timeout: 30_000,
		},
	);

	test(
		"a skipped quiz is stored as skipped",
		async () => {
			const chat = await askedQuiz();
			const call = askUserPart((await chat.stored())[1]);
			chat.script([
				{
					text: "Maybe later.",
				},
			]);

			await chat.answer([
				{
					toolCallId: String(call?.toolCallId),
					output: {
						status: "skipped",
					},
				},
			]);

			expect(askUserPart((await chat.stored())[1])).toMatchObject({
				state: "output-available",
				output: {
					status: "skipped",
				},
			});
		},
		{
			timeout: 30_000,
		},
	);

	test(
		"a new message instead of answers stores the quiz as declined",
		async () => {
			const chat = await askedQuiz();
			chat.script([
				{
					text: "Sure, no quiz.",
				},
			]);

			await chat.send("Actually, just tell me the capitals");

			const messages = await chat.stored();
			expect(messages.map((message) => message.role)).toEqual([
				"user",
				"assistant",
				"user",
				"assistant",
			]);
			expect(askUserPart(messages[1])).toMatchObject({
				state: "output-error",
				errorText: TOOL_CLOSE_SENTENCES.declined,
			});
		},
		{
			timeout: 30_000,
		},
	);
});
