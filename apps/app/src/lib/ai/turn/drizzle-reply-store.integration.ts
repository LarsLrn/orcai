import { describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createUser, integrationRuntime } from "@orcai/testing";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { DrizzleReplyStore } from "./drizzle-reply-store";
import { type NewMessage, ReplyStore } from "./reply-store";

const runtime = integrationRuntime();

const run = <A, E>(effect: Effect.Effect<A, E, ReplyStore | DB>) =>
	runtime.runPromise(effect.pipe(Effect.provide(DrizzleReplyStore)));

const newChat = Effect.gen(function* () {
	const user = yield* createUser();
	const [chat] = yield* (yield* DB)
		.insert(dbSchema.chat)
		.values({
			title: "Integration",
			userId: user.id,
		})
		.returning();
	return chat.id;
});

const question = (text: string): NewMessage => ({
	id: crypto.randomUUID() as ChatMessageId,
	role: "user",
	parts: [
		{
			type: "text",
			text,
		},
	],
	attachments: [],
	metadata: {},
});

const answer = (text: string) => ({
	parts: [
		{
			type: "text" as const,
			text,
		},
	],
	metadata: {},
});

/** A chat with one answered question; returns the chat and the reply's id. */
const answeredChat = Effect.gen(function* () {
	const store = yield* ReplyStore;
	const chatId = yield* newChat;
	const replyId = crypto.randomUUID() as ChatMessageId;
	yield* store.reserve({
		chatId,
		closedReply: undefined,
		question: question("First"),
		replyId,
	});
	yield* store.settle({
		chatId,
		replyId,
		reply: answer("Reply"),
	});
	return {
		chatId,
		replyId,
	};
});

const rows = (chatId: ChatId) =>
	Effect.gen(function* () {
		const loaded = yield* (yield* ReplyStore).load(chatId);
		return (loaded?.messages ?? []).map((message) => ({
			role: message.role,
			position: message.position,
			parts: message.parts,
		}));
	});

describe("DrizzleReplyStore", () => {
	test("finds no chat that does not exist", async () => {
		expect(
			await run(
				Effect.gen(function* () {
					return yield* (yield* ReplyStore).load(crypto.randomUUID() as ChatId);
				}),
			),
		).toBeUndefined();
	});

	test("appends the question and an empty reply after the last message, storing the closed reply", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, replyId } = yield* answeredChat;
				yield* (yield* ReplyStore).reserve({
					chatId,
					closedReply: {
						id: replyId,
						parts: answer("Closed").parts,
					},
					question: question("Second"),
					replyId: crypto.randomUUID() as ChatMessageId,
				});
				return yield* rows(chatId);
			}),
		);

		expect(result).toEqual([
			{
				role: "user",
				position: 0,
				parts: question("First").parts,
			},
			{
				role: "assistant",
				position: 1,
				parts: answer("Closed").parts,
			},
			{
				role: "user",
				position: 2,
				parts: question("Second").parts,
			},
			{
				role: "assistant",
				position: 3,
				parts: [],
			},
		]);
	});

	test("refuses a taken message id and stores nothing of the reservation", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, replyId } = yield* answeredChat;
				const refusal = yield* (yield* ReplyStore)
					.reserve({
						chatId,
						closedReply: {
							id: replyId,
							parts: answer("Closed").parts,
						},
						question: {
							...question("Again"),
							id: replyId,
						},
						replyId: crypto.randomUUID() as ChatMessageId,
					})
					.pipe(Effect.flip);
				return {
					reason: "reason" in refusal ? refusal.reason : undefined,
					rows: yield* rows(chatId),
				};
			}),
		);

		expect(result.reason).toBe("CHAT_MESSAGE_ID_TAKEN");
		expect(result.rows.map((row) => row.parts)).toEqual([
			question("First").parts,
			answer("Reply").parts,
		]);
	});

	test("hands a claim the reply only while it is the last message, and stores what it returns", async () => {
		const result = await run(
			Effect.gen(function* () {
				const store = yield* ReplyStore;
				const { chatId, replyId } = yield* answeredChat;
				const seen: unknown[] = [];
				const claim = () =>
					store.claim({
						chatId,
						replyId,
						update: (reply) => {
							seen.push(reply?.id);
							return Effect.succeed(answer("Claimed"));
						},
					});

				yield* claim();
				const claimed = yield* rows(chatId);
				yield* store.reserve({
					chatId,
					closedReply: undefined,
					question: question("Second"),
					replyId: crypto.randomUUID() as ChatMessageId,
				});
				yield* claim();
				return {
					seen,
					claimed: claimed.at(-1)?.parts,
				};
			}),
		);

		expect(result.seen).toEqual([
			expect.any(String),
			undefined,
		]);
		expect(result.claimed).toEqual(answer("Claimed").parts);
	});

	test("stores nothing when a claim's update fails", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, replyId } = yield* answeredChat;
				const failure = yield* (yield* ReplyStore)
					.claim({
						chatId,
						replyId,
						update: () => Effect.fail("not awaiting" as const),
					})
					.pipe(Effect.flip);
				return {
					failure,
					reply: (yield* rows(chatId)).at(-1)?.parts,
				};
			}),
		);

		expect(result).toEqual({
			failure: "not awaiting",
			reply: answer("Reply").parts,
		});
	});

	test("holds the chat during a claim, so a reservation lands after it", async () => {
		const result = await run(
			Effect.gen(function* () {
				const store = yield* ReplyStore;
				const { chatId, replyId } = yield* answeredChat;
				const claiming = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const order: string[] = [];

				yield* Effect.all(
					[
						store.claim({
							chatId,
							replyId,
							update: (reply) =>
								Deferred.succeed(claiming, undefined).pipe(
									Effect.andThen(Deferred.await(release)),
									Effect.andThen(
										Effect.sync(() => {
											order.push(reply ? "claimed last" : "claimed stale");
										}),
									),
									Effect.as(answer("Claimed")),
								),
						}),
						Deferred.await(claiming).pipe(
							Effect.andThen(
								Effect.all(
									[
										store
											.reserve({
												chatId,
												closedReply: undefined,
												question: question("Second"),
												replyId: crypto.randomUUID() as ChatMessageId,
											})
											.pipe(
												Effect.andThen(
													Effect.sync(() => {
														order.push("reserved");
													}),
												),
											),
										Effect.sleep("200 millis").pipe(
											Effect.andThen(Deferred.succeed(release, undefined)),
										),
									],
									{
										concurrency: "unbounded",
									},
								),
							),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				return order;
			}),
		);

		expect(result).toEqual([
			"claimed last",
			"reserved",
		]);
	});

	test("fills a settled reply and removes one without parts", async () => {
		const result = await run(
			Effect.gen(function* () {
				const store = yield* ReplyStore;
				const { chatId } = yield* answeredChat;
				const replyId = crypto.randomUUID() as ChatMessageId;
				yield* store.reserve({
					chatId,
					closedReply: undefined,
					question: question("Second"),
					replyId,
				});
				yield* store.settle({
					chatId,
					replyId,
					reply: {
						parts: [],
						metadata: {},
					},
				});
				return yield* rows(chatId);
			}),
		);

		expect(result.map((row) => row.role)).toEqual([
			"user",
			"assistant",
			"user",
		]);
	});
});
