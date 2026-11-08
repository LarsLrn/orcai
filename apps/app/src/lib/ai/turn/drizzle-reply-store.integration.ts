import { describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ChatMessagePart } from "@orcai/schema";
import {
	awaitLockWaiters,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import * as AppErrors from "@/lib/effect/utils/errors";
import { DrizzleReplyStore } from "./drizzle-reply-store";
import { type NewMessage, ReplyStore } from "./reply-store";

const runtime = integrationRuntime();

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ReplyStore | ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect.pipe(Effect.provide(DrizzleReplyStore)));

const newChat = Effect.gen(function* () {
	const db = yield* DB;
	const user = yield* createUser();
	const suffix = crypto.randomUUID();
	const [organization] = yield* db
		.insert(dbSchema.organization)
		.values({
			name: `Reply store ${suffix}`,
			slug: `reply-store-${suffix}`,
			createdAt: new Date(),
		})
		.returning();
	const [chat] = yield* db
		.insert(dbSchema.chat)
		.values({
			title: "Integration",
			userId: user.id,
			organizationId: organization.id,
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

const kept = {
	type: "text",
	text: "Kept",
	state: "done",
} as const;

const rewritten = {
	type: "text",
	text: "Rewritten",
	state: "done",
} as const;

/** A readable text part, then parts this version cannot read. */
const unreadable = [
	kept,
	{
		type: "tool-invocation",
		toolInvocation: {
			state: "result",
			toolCallId: "call-0",
		},
	},
	{
		type: "text",
		content: "No text field",
	},
	{
		type: "future-part",
		payload: 1,
	},
];

/** A chat whose only message is a reply holding `unreadable`. */
const unreadableReply = Effect.gen(function* () {
	const chatId = yield* newChat;
	const id = crypto.randomUUID() as ChatMessageId;
	yield* (yield* DB).insert(dbSchema.chatMessage).values({
		id,
		chatId,
		role: "assistant",
		parts: unreadable,
		attachments: [],
		metadata: {},
		position: 0,
	});
	return {
		chatId,
		id,
	};
});

const rawParts = (id: ChatMessageId) =>
	Effect.gen(function* () {
		const [row] = yield* (yield* DB)
			.select({
				parts: dbSchema.chatMessage.parts,
			})
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.id, id));
		return row?.parts;
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
										awaitLockWaiters('update "chat" set%').pipe(
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

	test("reads the parts it knows and leaves the stored row as it is", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, id } = yield* unreadableReply;
				return {
					read: (yield* rows(chatId)).map((message) => message.parts),
					row: yield* rawParts(id),
				};
			}),
		);

		expect(result.read).toEqual([
			[
				kept,
			],
		]);
		expect(result.row).toEqual(unreadable);
	});

	test("closing a reply rewrites only the parts it reads", async () => {
		const row = await run(
			Effect.gen(function* () {
				const { chatId, id } = yield* unreadableReply;
				yield* (yield* ReplyStore).reserve({
					chatId,
					closedReply: {
						id,
						parts: [
							rewritten,
						],
					},
					question: question("Next"),
					replyId: crypto.randomUUID() as ChatMessageId,
				});
				return yield* rawParts(id);
			}),
		);

		expect(row).toEqual([
			rewritten,
			...unreadable.slice(1),
		]);
	});

	test("a claim writes its parts over the readable ones and keeps the rest", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, id } = yield* unreadableReply;
				const claimed = yield* (yield* ReplyStore).claim({
					chatId,
					replyId: id,
					update: (reply) =>
						Effect.succeed({
							parts: [
								...(reply?.parts ?? []),
								rewritten,
							],
							metadata: {},
						}),
				});
				return {
					claimed: claimed.parts,
					row: yield* rawParts(id),
				};
			}),
		);

		expect(result.claimed).toEqual([
			kept,
			rewritten,
		]);
		expect(result.row).toEqual([
			...unreadable,
			rewritten,
		]);
	});

	test("a claim without parts changes only the metadata", async () => {
		const result = await run(
			Effect.gen(function* () {
				const { chatId, id } = yield* unreadableReply;
				yield* (yield* ReplyStore).claim({
					chatId,
					replyId: id,
					update: () =>
						Effect.succeed({
							metadata: {
								continuedAt: "2026-11-08T10:00:00.000Z",
							},
						}),
				});
				const loaded = yield* (yield* ReplyStore).load(chatId);
				return {
					metadata: loaded?.messages[0]?.metadata,
					row: yield* rawParts(id),
				};
			}),
		);

		expect(result.metadata).toEqual({
			continuedAt: "2026-11-08T10:00:00.000Z",
		});
		expect(result.row).toEqual(unreadable);
	});

	test("settling a reply keeps the parts it cannot read", async () => {
		const row = await run(
			Effect.gen(function* () {
				const { chatId, id } = yield* unreadableReply;
				yield* (yield* ReplyStore).settle({
					chatId,
					replyId: id,
					reply: {
						parts: [
							rewritten,
						],
						metadata: {},
					},
				});
				return yield* rawParts(id);
			}),
		);

		expect(row).toEqual([
			rewritten,
			...unreadable.slice(1),
		]);
	});

	test("stores no part that fails its schema", async () => {
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
				const error = yield* Effect.flip(
					store.settle({
						chatId,
						replyId,
						reply: {
							parts: [
								{
									type: "text",
								} as unknown as ChatMessagePart,
							],
							metadata: {},
						},
					}),
				);
				return {
					error,
					last: (yield* rows(chatId)).at(-1),
				};
			}),
		);

		expect(result.error).toBeInstanceOf(AppErrors.InternalError);
		expect(result.last?.parts).toEqual([]);
	});
});
