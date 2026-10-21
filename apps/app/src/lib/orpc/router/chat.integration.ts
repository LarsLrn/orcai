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

const textMessage = (text: string) => [
	{
		type: "text" as const,
		text,
	},
];

/** Two members of one organisation, each able to create chats with messages and search. */
const searchers = async () => {
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

	const search = async (actor: Actor, term: string) =>
		(
			await run(
				procedures.chat.list(
					{
						pageIndex: 0,
						pageSize: 20,
						filters: {
							search: term,
						},
					},
					await procedureOptions(actor, token),
				),
			)
		).data;

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
		search,
		listMessages,
	};
};

describe("chat search", () => {
	test(
		"finds titles and message text by prefix, titles first, with the matching message",
		async () => {
			const { owner, createChat, search } = await searchers();
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
			const { owner, createChat, search } = await searchers();
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
			const { owner, other, createChat, search } = await searchers();
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
		"follows message edits",
		async () => {
			const { owner, createChat, search } = await searchers();
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
			const { owner, createChat, listMessages } = await searchers();
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
