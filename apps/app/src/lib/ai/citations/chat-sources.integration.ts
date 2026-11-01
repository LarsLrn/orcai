import { describe, expect, test } from "bun:test";
import type { AssetId, ChatId, ChatMessageId } from "@orcai/core";
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

const attachedAssets = new Map<string, AssetId>();

/** The asset a question of turn `label` attaches. */
const assetOf = (label: string) => {
	const known = attachedAssets.get(label);
	if (known) return known;
	const assetId = crypto.randomUUID() as AssetId;
	attachedAssets.set(label, assetId);
	return assetId;
};

/** A question with an attachment, then a reply that searched and found `pointId`. */
const searchTurn = (pointId: string) => [
	{
		role: "user",
		parts: [
			{
				type: "text",
				text: "Search.",
			},
		],
		attachments: [
			{
				assetId: assetOf(pointId),
				title: `File ${pointId}`,
				fileType: "text/plain",
				size: 1,
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

/** The refs of turn `label`'s passage and attachment. */
const refsOf = (label: string) => [
	sourceRef("passage", label),
	sourceRef("attachment", assetOf(label)),
];

const cites = (...labels: string[]) =>
	labels
		.flatMap(refsOf)
		.map((ref) => `<cite ref=${ref}>${ref}</cite>`)
		.join(" ");

describe("chat sources of a branch", () => {
	test(
		"resolve the passages and attachments of the copied messages only, not what the parent added later or other chats hold",
		async () => {
			const {
				actors: [owner, other],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
			]);
			const procedures = await run(Procedures);
			let token = zedToken;

			const createChat = async (turns: string[], actor = owner) => {
				const { data: chat, meta } = await run(
					procedures.chat.create(
						{
							title: "Sources",
						},
						await procedureOptions(actor, token),
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
									attachments: message.attachments ?? [],
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
					(loaded?.messages ?? []).map(({ role, parts, attachments }) => ({
						role,
						parts: parts as {
							type: string;
						}[],
						attachments,
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
			await createChat(
				[
					"foreign",
				],
				other,
			);
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

			const cited = cites("before", "after", "elsewhere", "foreign");
			const resolved = async (chatId: ChatId) =>
				Object.keys((await sourcesOf(chatId)).citations(cited)).sort();

			expect(await resolved(branch.id)).toEqual(refsOf("before").sort());
			expect(await resolved(parent.chatId)).toEqual(
				[
					...refsOf("before"),
					...refsOf("after"),
				].sort(),
			);
		},
		TIMEOUT,
	);
});
