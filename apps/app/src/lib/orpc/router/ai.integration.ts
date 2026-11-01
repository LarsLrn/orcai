import { describe, expect, test } from "bun:test";
import type { AssetId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const UPLOAD_CALL = "upload-1";

/** An assistant conversation of the first member whose reply waits for an upload. */
const waitingUpload = async () => {
	const {
		organizationId,
		actors: [owner, other],
		zedToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	const procedures = await run(Procedures);
	const { data: chat } = await run(
		procedures.assistant.create({}, await procedureOptions(owner, zedToken)),
	);
	const replyId = crypto.randomUUID() as ChatMessageId;
	await run(
		Effect.gen(function* () {
			yield* (yield* DB).insert(dbSchema.chatMessage).values([
				{
					id: crypto.randomUUID() as ChatMessageId,
					chatId: chat.id,
					role: "user",
					parts: [
						{
							type: "text",
							text: "Add my style guide",
						},
					],
					attachments: [],
					metadata: {},
					position: 0,
				},
				{
					id: replyId,
					chatId: chat.id,
					role: "assistant",
					parts: [
						{
							type: "step-start",
						},
						{
							type: "tool-requestUpload",
							toolCallId: UPLOAD_CALL,
							state: "input-available",
							input: {
								reason: "Upload the style guide.",
							},
						},
					],
					attachments: [],
					metadata: {},
					position: 1,
				},
			]);
		}),
	);
	const storedUploads = () =>
		run(
			Effect.gen(function* () {
				const [row] = yield* (yield* DB)
					.select({
						metadata: dbSchema.chatMessage.metadata,
					})
					.from(dbSchema.chatMessage)
					.where(eq(dbSchema.chatMessage.id, replyId));
				return row?.metadata.uploads;
			}),
		);
	return {
		organizationId,
		owner,
		other,
		keep: async (assetIds: AssetId[], token?: string) =>
			run(
				procedures.ai.keepUploads(
					{
						chatId: chat.id,
						messageId: replyId,
						toolCallId: UPLOAD_CALL,
						assetIds,
						zedToken: token,
					},
					await procedureOptions(owner, token ?? zedToken),
				),
			),
		storedUploads,
	};
};

describe("ai.keepUploads", () => {
	test(
		"keeps only the owner's uploads in the conversation's organisation, once each, with their stored titles",
		async () => {
			const { organizationId, owner, other, keep, storedUploads } =
				await waitingUpload();
			const elsewhere = await run(
				createOrganization({
					members: [
						{
							userId: owner.user.id,
							role: "member",
						},
					],
				}),
			);
			const own = await createAsset(owner, organizationId);
			const others = await createAsset(other, organizationId);
			const foreign = await createAsset(owner, elsewhere.organization.id);
			const missing = crypto.randomUUID() as AssetId;

			const { data } = await keep(
				[
					missing,
					others.asset.id,
					own.asset.id,
					foreign.asset.id,
					own.asset.id,
				],
				foreign.zedToken,
			);

			const expected = {
				assets: [
					{
						id: own.asset.id,
						title: own.asset.title,
					},
				],
				zedToken: foreign.zedToken,
			};
			expect(data).toEqual(expected);
			expect(await storedUploads()).toEqual({
				[UPLOAD_CALL]: expected,
			});
		},
		TIMEOUT,
	);
});

describe("ai.recordTurnWrites", () => {
	/** An assistant conversation of the first member whose stored reply carries the token of an asset its turn wrote. */
	const finishedTurn = async () => {
		const {
			organizationId,
			actors: [owner, other],
			zedToken,
		} = await organizationWith([
			"member",
			"member",
		]);
		const procedures = await run(Procedures);
		const { data: chat, meta } = await run(
			procedures.assistant.create({}, await procedureOptions(owner, zedToken)),
		);
		const written = await createAsset(owner, organizationId);
		const replyId = crypto.randomUUID() as ChatMessageId;
		await run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.chatMessage).values({
					id: replyId,
					chatId: chat.id,
					role: "assistant",
					parts: [
						{
							type: "text",
							text: "Done.",
						},
					],
					attachments: [],
					metadata: {
						zedToken: written.zedToken,
					},
					position: 0,
				});
			}),
		);
		return {
			owner,
			other,
			writtenToken: written.zedToken,
			record: async (actor: typeof owner) =>
				run(
					procedures.ai.recordTurnWrites(
						{
							chatId: chat.id,
							messageId: replyId,
							zedToken: meta?.zedToken,
						},
						await procedureOptions(actor, zedToken),
					),
				),
		};
	};

	test(
		"hands the stored reply's token to the response, which sets the cookie",
		async () => {
			const { owner, writtenToken, record } = await finishedTurn();

			expect(await record(owner)).toEqual({
				success: true,
				meta: {
					zedToken: writtenToken,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"refuses a member who cannot read the conversation",
		async () => {
			const { other, record } = await finishedTurn();

			await expect(record(other)).rejects.toMatchObject({
				_tag: "ForbiddenError",
			});
		},
		TIMEOUT,
	);
});
