import { describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import * as Effect from "effect/Effect";
import { DrizzleReplyStore } from "@/lib/ai/turn/drizzle-reply-store";
import { ReplyStore } from "@/lib/ai/turn/reply-store";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { chatSources } from "./chat-sources";
import { sourceRef } from "./source-ref";

const { run, organizationWith, procedureOptions } = authzIntegration();

const passage = (id: string) => ({
	ref: sourceRef("passage", id),
	id,
	assetId: `asset-${id}`,
	title: `Title ${id}`,
	blockName: "Handbook",
	text: `Text ${id}`,
});

/** A question, then a reply that searched and found `pointId`. */
const searchTurn = (pointId: string) => [
	{
		role: "user",
		parts: [
			{
				type: "text",
				text: "Search.",
			},
		],
	},
	{
		role: "assistant",
		parts: [
			{
				type: "tool-searchRepositories",
				toolCallId: crypto.randomUUID(),
				state: "output-available",
				input: {
					query: "q",
				},
				output: {
					results: [
						passage(pointId),
					],
				},
			},
		],
	},
];

const cites = (...ids: string[]) =>
	ids
		.map((id) => `<cite ref=${sourceRef("passage", id)}>${id}</cite>`)
		.join(" ");

describe("chat sources of a branch", () => {
	test(
		"resolve the copied messages only, not what the parent found later or another chat found",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"member",
			]);
			const procedures = await run(Procedures);
			let token = zedToken;

			const createChat = async (turns: string[]) => {
				const { data: chat, meta } = await run(
					procedures.chat.create(
						{
							title: "Sources",
						},
						await procedureOptions(owner, token),
					),
				);
				token = meta?.zedToken ?? token;
				const messages = turns.flatMap(searchTurn);
				const ids = await run(
					Effect.gen(function* () {
						const rows = yield* (yield* DB)
							.insert(dbSchema.chatMessage)
							.values(
								messages.map((message, position) => ({
									id: crypto.randomUUID() as ChatMessageId,
									chatId: chat.id,
									role: message.role,
									parts: message.parts,
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

			/** The chat's sources, from its stored messages as a turn loads them. */
			const sourcesOf = async (chatId: ChatId) => {
				const loaded = await run(
					Effect.gen(function* () {
						return yield* (yield* ReplyStore).load(chatId);
					}).pipe(Effect.provide(DrizzleReplyStore)),
				);
				return chatSources(
					(loaded?.messages ?? []).map(({ parts }) => ({
						parts: parts as {
							type: string;
						}[],
					})),
				);
			};

			const parent = await createChat([
				"before",
				"after",
			]);
			await createChat([
				"elsewhere",
			]);
			const { data: branch } = await run(
				procedures.chat.branch(
					{
						chatId: parent.chatId,
						// The reply of the first turn.
						messageId: parent.messageIds[1],
					},
					await procedureOptions(owner, token),
				),
			);

			const cited = cites("before", "after", "elsewhere");

			expect(
				Object.keys((await sourcesOf(branch.id)).citations(cited)),
			).toEqual([
				sourceRef("passage", "before"),
			]);
			expect(
				Object.keys((await sourcesOf(parent.chatId)).citations(cited)),
			).toEqual([
				sourceRef("passage", "before"),
				sourceRef("passage", "after"),
			]);
		},
		TIMEOUT,
	);
});
