import { describe, expect, test } from "bun:test";
import { buckets, type ChatMessageId, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { buildStoredExtractionKey } from "@orcai/process";
import { assetObjectKey } from "@orcai/s3";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import { integrationRuntime } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { sourceRef } from "@/lib/ai/citations/source-ref";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH } from "@/settings/constants";
import { attachAssets, attachmentReader } from "./attachments";
import { assetFixtures, PIXEL } from "./test-assets";

const runtime = integrationRuntime(S3Live);

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	runtime.runPromise(effect as Effect.Effect<A, E, never>);

const { newUser, relate, privateImage, privateAssets } = assetFixtures(run);

const question = (
	attachments: ChatAgentUIMessage["attachments"],
): ChatAgentUIMessage => ({
	id: crypto.randomUUID() as ChatMessageId,
	role: "user",
	parts: [
		{
			type: "text",
			text: "What does this show?",
		},
	],
	attachments,
});

const attachmentPartsOf = async (
	message: ChatAgentUIMessage,
	reader: {
		userId: UserId;
		zedToken: string | undefined;
	},
) => {
	const [prompt] = await run(
		attachmentReader(reader)([
			message,
		]),
	);
	return prompt.parts.slice(message.parts.length);
};

describe("chat attachments", () => {
	test("a user cannot attach another user's private asset", async () => {
		const owner = await newUser();
		const intruder = await newUser();
		const { asset, zedToken } = await privateImage(owner);

		const error = await run(
			attachAssets(
				[
					{
						assetId: asset.id,
					},
				],
				{
					userId: intruder,
					zedToken,
				},
			).pipe(Effect.flip),
		);

		expect(error).toMatchObject({
			reason: "PERMISSION_DENIED",
			data: {
				entityType: "asset",
			},
		});
	});

	test("an attachment is described by its asset", async () => {
		const owner = await newUser();
		const { asset, zedToken } = await privateImage(owner);

		const attachments = await run(
			attachAssets(
				[
					{
						assetId: asset.id,
					},
				],
				{
					userId: owner,
					zedToken,
				},
			),
		);

		expect(attachments).toEqual([
			{
				assetId: asset.id,
				title: "Floor plan",
				fileType: "image/png",
				size: 70,
			},
		]);
	});

	test("an attachment whose access was revoked becomes a note on the next turn", async () => {
		const owner = await newUser();
		const viewer = await newUser();
		const { asset } = await privateImage(owner);
		const shared = await relate(asset.id, "viewer", viewer);
		const attachments = await run(
			attachAssets(
				[
					{
						assetId: asset.id,
					},
				],
				{
					userId: viewer,
					zedToken: shared.zedToken,
				},
			),
		);
		const message = question(attachments);

		const before = await attachmentPartsOf(message, {
			userId: viewer,
			zedToken: shared.zedToken,
		});
		expect(before).toEqual([
			{
				type: "text",
				text: [
					`<attachment ref=${sourceRef("attachment", asset.id)} title="Floor plan" media-type="image/png">`,
					"Image in the next part.",
					"</attachment>",
				].join("\n"),
			},
			{
				type: "file",
				mediaType: "image/png",
				filename: "Floor plan",
				url: `data:image/png;base64,${PIXEL}`,
			},
		]);

		const revoked = await relate(asset.id, "viewer", viewer, "delete");
		const after = await attachmentPartsOf(message, {
			userId: viewer,
			zedToken: revoked.zedToken,
		});

		expect(after).toEqual([
			{
				type: "text",
				text: 'Attachment "Floor plan" is no longer available.',
			},
		]);
	});

	test("an attachment whose asset was deleted becomes a note", async () => {
		const owner = await newUser();
		const { asset, zedToken } = await privateImage(owner);
		const attachments = await run(
			attachAssets(
				[
					{
						assetId: asset.id,
					},
				],
				{
					userId: owner,
					zedToken,
				},
			),
		);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.delete(dbSchema.asset)
					.where(eq(dbSchema.asset.id, asset.id));
			}),
		);

		const parts = await attachmentPartsOf(question(attachments), {
			userId: owner,
			zedToken,
		});

		expect(parts).toEqual([
			{
				type: "text",
				text: 'Attachment "Floor plan" is no longer available.',
			},
		]);
	});

	test("images past the turn's image budget become a note, oldest first, also when older turns are read later", async () => {
		const owner = await newUser();
		const older = await privateImage(owner, {
			title: "Old plan",
			size: 15 * 1024 * 1024,
		});
		const newer = await privateImage(owner, {
			title: "New plan",
			size: 10 * 1024 * 1024,
		});
		const reader = {
			userId: owner,
			zedToken: newer.zedToken,
		};
		const history = [
			question(
				await run(
					attachAssets(
						[
							{
								assetId: older.asset.id,
							},
						],
						reader,
					),
				),
			),
			question(
				await run(
					attachAssets(
						[
							{
								assetId: newer.asset.id,
							},
						],
						reader,
					),
				),
			),
		];

		const prompt = await run(attachmentReader(reader)(history));

		expect(prompt.map((message) => message.parts.at(-1))).toEqual([
			{
				type: "text",
				text: 'Attachment "Old plan" is left out to keep the request small.',
			},
			{
				type: "file",
				mediaType: "image/png",
				filename: "New plan",
				url: `data:image/png;base64,${PIXEL}`,
			},
		]);
		const read = attachmentReader(reader);
		const newest = await run(read(history.slice(1)));
		const oldest = await run(read(history.slice(0, 1)));
		expect([
			...oldest,
			...newest,
		]).toEqual(prompt);
	});

	test("a file cut at the text limit is marked truncated, a file within it is not", async () => {
		const owner = await newUser();
		const limit = CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH;
		const { assets, zedToken } = await privateAssets(owner, [
			{
				title: "Essay",
				content: "a".repeat(limit),
			},
			{
				title: "Thesis",
				content: "a".repeat(limit + 1),
			},
		]);
		const reader = {
			userId: owner,
			zedToken,
		};
		const attached = await run(
			attachAssets(
				assets.map((asset) => ({
					assetId: asset.id,
				})),
				reader,
			),
		);

		const [prompt] = await run(
			attachmentReader(reader)([
				question(attached),
			]),
		);

		expect(
			prompt.attachments?.map(({ title, truncated }) => [
				title,
				truncated,
			]),
		).toEqual([
			[
				"Essay",
				undefined,
			],
			[
				"Thesis",
				true,
			],
		]);
	});

	test("a file whose stored extraction is unreadable is read from the file itself", async () => {
		const owner = await newUser();
		const asset = await run(
			Effect.gen(function* () {
				const [row] = yield* (yield* DB)
					.insert(dbSchema.asset)
					.values({
						bucket: buckets.main.name,
						prefix: `users/${owner}/chatAttachment/2026/10`,
						title: "Field notes",
						fileType: "txt",
						size: 22,
						userId: owner,
					})
					.returning();
				yield* sendPutObjectCommand({
					bucket: row.bucket,
					key: assetObjectKey(row),
					body: Buffer.from("Soil samples at 30 cm."),
					contentType: "text/plain",
				});
				yield* sendPutObjectCommand({
					bucket: buckets.processed.name,
					key: buildStoredExtractionKey(row.id),
					body: Buffer.from('{"content":'),
					contentType: "application/json",
				});
				return row;
			}),
		);
		const { zedToken } = await relate(asset.id, "owner", owner);
		const reader = {
			userId: owner,
			zedToken,
		};
		const attached = await run(
			attachAssets(
				[
					{
						assetId: asset.id,
					},
				],
				reader,
			),
		);

		const parts = await attachmentPartsOf(question(attached), reader);

		expect(JSON.stringify(parts)).toContain("Soil samples at 30 cm.");
	});
});
