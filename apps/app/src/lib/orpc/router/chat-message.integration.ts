import { describe, expect, test } from "bun:test";
import type { ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { appendChatMessages } from "@/lib/ai/turn/drizzle-reply-store";
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

/** A chat of the first member holding one reply, with the other member beside it. */
const chatWithReply = async () => {
	const {
		actors: [owner, other],
		zedToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	const procedures = await run(Procedures);
	const { data: chat, meta } = await run(
		procedures.chat.create(
			{
				title: "Rating",
			},
			await procedureOptions(owner, zedToken),
		),
	);
	const [message] = await run(
		appendChatMessages(chat.id, [
			{
				id: crypto.randomUUID() as ChatMessageId,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: "Answer",
					},
				],
				attachments: [],
				metadata: {},
			},
		]),
	);
	const token = meta?.zedToken ?? zedToken;
	const call = async <A>(
		actor: Actor,
		procedure: (
			procedures: Procedures["Service"],
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<A, unknown>,
	) => run(procedure(procedures, await procedureOptions(actor, token)));
	return {
		owner,
		other,
		optionsFor: (actor: Actor) => procedureOptions(actor, token),
		chatId: chat.id,
		messageId: message.id,
		rate: (
			actor: Actor,
			rating: "very_much" | "a_bit" | "not_really" | "not_at_all" | null,
		) =>
			call(actor, (p, options) =>
				p.chatMessage.rate(
					{
						chatId: chat.id,
						id: message.id,
						rating,
					},
					options,
				),
			),
		ratings: (actor: Actor) =>
			call(actor, (p, options) =>
				p.chatMessage.listRatings(
					{
						chatId: chat.id,
					},
					options,
				),
			).then(({ data }) => data),
		storedRows: (messageId: ChatMessageId) =>
			run(
				Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.select()
						.from(dbSchema.chatMessageRating)
						.where(eq(dbSchema.chatMessageRating.messageId, messageId));
				}),
			),
	};
};

describe("message ratings", () => {
	test(
		"rating again replaces the rating, and null clears it",
		async () => {
			const { owner, messageId, rate, ratings, storedRows } =
				await chatWithReply();
			expect(await ratings(owner)).toEqual([]);

			await rate(owner, "very_much");
			await rate(owner, "not_really");
			expect(await ratings(owner)).toEqual([
				{
					messageId,
					rating: "not_really",
				},
			]);
			expect(await storedRows(messageId)).toHaveLength(1);

			await rate(owner, null);
			expect(await ratings(owner)).toEqual([]);
			expect(await storedRows(messageId)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"a user who cannot read the chat can neither rate nor list",
		async () => {
			const { owner, other, messageId, rate, ratings, storedRows } =
				await chatWithReply();
			await rate(owner, "a_bit");

			expect(await rejection(rate(other, "very_much"))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await rejection(ratings(other))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await storedRows(messageId)).toMatchObject([
				{
					rating: "a_bit",
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"a message of another chat cannot be rated through this one",
		async () => {
			const { owner, messageId, rate, optionsFor } = await chatWithReply();
			const procedures = await run(Procedures);
			const { data: otherChat, meta } = await run(
				procedures.chat.create(
					{
						title: "Other",
					},
					await optionsFor(owner),
				),
			);
			expect(
				await rejection(
					run(
						procedures.chatMessage.rate(
							{
								chatId: otherChat.id,
								id: messageId,
								rating: "a_bit",
							},
							await procedureOptions(owner, meta?.zedToken),
						),
					),
				),
			).toMatchObject({
				reason: "CHAT_MESSAGE_NOT_FOUND",
			});
			expect(await rate(owner, "a_bit")).toMatchObject({
				data: {
					rating: "a_bit",
				},
			});
		},
		TIMEOUT,
	);
});
