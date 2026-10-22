import { describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const textMessage = (text: string) => [
	{
		type: "text" as const,
		text,
	},
];

/** Two members of one organisation and the chat procedures they call. */
const members = async () => {
	const {
		actors: [owner, other],
		zedToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;

	const createChat = async (
		actor: Actor,
		title: string | null,
		messages: string[] = [],
	) => {
		const { data: chat, meta } = await run(
			procedures.chat.create(
				{
					title,
				},
				await procedureOptions(actor, token),
			),
		);
		token = meta?.zedToken ?? token;
		const ids = await run(
			Effect.gen(function* () {
				if (messages.length === 0) return [];
				const rows = yield* (yield* DB)
					.insert(dbSchema.chatMessage)
					.values(
						messages.map((text, position) => ({
							id: crypto.randomUUID() as ChatMessageId,
							chatId: chat.id,
							role: position % 2 === 0 ? "user" : "assistant",
							parts: textMessage(text),
							attachments: [],
							metadata: {},
							position,
						})),
					)
					.returning({
						id: dbSchema.chatMessage.id,
					});
				return rows.map((row) => row.id);
			}),
		);
		return {
			chatId: chat.id,
			messageIds: ids,
		};
	};

	const call = async <A>(
		actor: Actor,
		procedure: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(procedure(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const list = async (actor: Actor, search?: string) =>
		(
			await call(actor, (options) =>
				procedures.chat.list(
					{
						pageIndex: 0,
						pageSize: 20,
						filters: {
							search,
						},
					},
					options,
				),
			)
		).data;

	const search = (actor: Actor, term: string) => list(actor, term);

	const pin = (actor: Actor, chatId: ChatId, pinned: boolean) =>
		call(actor, (options) =>
			procedures.chat.pin(
				{
					id: chatId,
					pinned,
				},
				options,
			),
		);

	const branch = async (
		actor: Actor,
		chatId: ChatId,
		messageId: ChatMessageId,
	) =>
		(
			await call(actor, (options) =>
				procedures.chat.branch(
					{
						chatId,
						messageId,
					},
					options,
				),
			)
		).data;

	const createAssistantConversation = async (actor: Actor, text: string) => {
		const { data: chat } = await call(actor, (options) =>
			procedures.assistant.create({}, options),
		);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.chatMessage).values({
					id: crypto.randomUUID() as ChatMessageId,
					chatId: chat.id,
					role: "user",
					parts: textMessage(text),
					attachments: [],
					metadata: {},
					position: 0,
				});
			}),
		);
		return chat.id;
	};

	const listMessages = async (
		actor: Actor,
		chatId: ChatId,
		through: ChatMessageId,
	) =>
		run(
			procedures.chatMessage.list(
				{
					chatId,
					through,
					limit: 2,
				},
				await procedureOptions(actor, token),
			),
		);

	return {
		owner,
		other,
		createChat,
		createAssistantConversation,
		list,
		search,
		pin,
		branch,
		listMessages,
	};
};

describe("chat search", () => {
	test(
		"finds titles and message text by prefix, titles first, with the matching message",
		async () => {
			const { owner, createChat, search } = await members();
			const titled = await createChat(owner, "Quarterly budget review");
			const mentioned = await createChat(owner, "Planning", [
				"What should we plan?",
				"Start with the budgeting numbers for next year.",
			]);
			await createChat(owner, "Unrelated", [
				"Nothing to see here",
			]);

			const results = await search(owner, "budg");

			expect(results.map((chat) => chat.id)).toEqual([
				titled.chatId,
				mentioned.chatId,
			]);
			expect(results[0].match).toBeNull();
			expect(results[1].match).toEqual({
				messageId: mentioned.messageIds[1],
				snippet: [
					{
						text: "Start with the ",
						highlighted: false,
					},
					{
						text: "budgeting",
						highlighted: true,
					},
					{
						text: " numbers for next year",
						highlighted: false,
					},
				],
			});
		},
		TIMEOUT,
	);

	test(
		"every term must match, and only the last is a prefix",
		async () => {
			const { owner, createChat, search } = await members();
			const both = await createChat(owner, null, [
				"Ferries leave Kiel at noon",
			]);
			await createChat(owner, null, [
				"Ferries leave Oslo at night",
			]);

			expect(
				(await search(owner, "ferries kie")).map((chat) => chat.id),
			).toEqual([
				both.chatId,
			]);
			expect(await search(owner, "ferr kiel")).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"finds only the caller's own chats",
		async () => {
			const { owner, other, createChat, search } = await members();
			const own = await createChat(owner, null, [
				"Tangerine harvest notes",
			]);
			await createChat(other, "Tangerine", [
				"Tangerine harvest notes",
			]);

			expect((await search(owner, "tangerine")).map((chat) => chat.id)).toEqual(
				[
					own.chatId,
				],
			);
		},
		TIMEOUT,
	);

	test(
		"finds the caller's assistant conversations too",
		async () => {
			const { owner, createAssistantConversation, list, search } =
				await members();
			const conversation = await createAssistantConversation(
				owner,
				"Draft a bot for wombat care",
			);

			expect((await search(owner, "wombat")).map((chat) => chat.id)).toEqual([
				conversation,
			]);
			expect(await list(owner)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"follows message edits",
		async () => {
			const { owner, createChat, search } = await members();
			const chat = await createChat(owner, null, [
				"Original wording",
			]);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.chatMessage)
						.set({
							parts: textMessage("Revised phrasing"),
						})
						.where(eq(dbSchema.chatMessage.id, chat.messageIds[0]));
				}),
			);

			expect(await search(owner, "original")).toEqual([]);
			expect((await search(owner, "revised")).map((row) => row.id)).toEqual([
				chat.chatId,
			]);
		},
		TIMEOUT,
	);

	test(
		"opens a chat from the matching message through the newest",
		async () => {
			const { owner, createChat, listMessages } = await members();
			const chat = await createChat(owner, null, [
				"one",
				"two",
				"three",
				"four",
				"five",
			]);

			const page = await listMessages(owner, chat.chatId, chat.messageIds[1]);

			expect(page.data.map((message) => message.id)).toEqual(
				chat.messageIds.slice(1),
			);
			expect(page.hasMore).toBe(true);
		},
		TIMEOUT,
	);
});

describe("chat pins", () => {
	test(
		"a pinned chat leads the list until it is unpinned",
		async () => {
			const { owner, createChat, list, pin } = await members();
			const older = await createChat(owner, "Older");
			const newer = await createChat(owner, "Newer");

			const pinned = await pin(owner, older.chatId, true);
			expect(pinned.data.pinnedAt).toBeInstanceOf(Date);
			expect((await list(owner)).map((chat) => chat.id)).toEqual([
				older.chatId,
				newer.chatId,
			]);

			await pin(owner, older.chatId, false);
			const unpinned = await list(owner);
			expect(unpinned.map((chat) => chat.id)).toEqual([
				newer.chatId,
				older.chatId,
			]);
			expect(unpinned.every((chat) => chat.pinnedAt === null)).toBe(true);
		},
		TIMEOUT,
	);

	test(
		"a branch of a pinned chat starts unpinned",
		async () => {
			const { owner, createChat, pin, branch } = await members();
			const source = await createChat(owner, "Source", [
				"Question",
				"Answer",
			]);
			await pin(owner, source.chatId, true);

			const copy = await branch(owner, source.chatId, source.messageIds[1]);

			expect(copy.pinnedAt).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"only the owner pins, and never an assistant conversation",
		async () => {
			const { owner, other, createChat, createAssistantConversation, pin } =
				await members();
			const chat = await createChat(owner, "Mine");
			const conversation = await createAssistantConversation(owner, "Hello");

			expect(await rejection(pin(other, chat.chatId, true))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await rejection(pin(owner, conversation, true))).toMatchObject({
				reason: "ASSISTANT_CONVERSATION_IMMUTABLE",
			});
		},
		TIMEOUT,
	);
});
