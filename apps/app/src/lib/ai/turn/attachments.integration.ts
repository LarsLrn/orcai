import { describe, expect, test } from "bun:test";
import {
	type AssetId,
	buckets,
	type ChatMessageId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { S3Live } from "@orcai/s3/server";
import { writeRelationshipMutations } from "@orcai/spice-db";
import { createUser, integrationRuntime } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { attachAssets, withAttachmentParts } from "./attachments";

const runtime = integrationRuntime();

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	runtime.runPromise(
		effect.pipe(Effect.provide(S3Live)) as Effect.Effect<A, E, never>,
	);

const newUser = () => run(createUser().pipe(Effect.map((user) => user.id)));

/** An image asset only its owner can read, and the token of that write. */
const privateImage = async (owner: UserId) => {
	const asset = await run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.insert(dbSchema.asset)
				.values({
					bucket: buckets.main.name,
					prefix: `users/${owner}/chatAttachment/2026/10`,
					title: "Floor plan",
					fileType: "png",
					size: 128,
					userId: owner,
				})
				.returning();
			return row;
		}),
	);
	const { zedToken } = await relate(asset.id, "owner", owner);
	return {
		asset,
		zedToken,
	};
};

const relate = (
	assetId: AssetId,
	relation: "owner" | "viewer",
	userId: UserId,
	operation: "create" | "delete" = "create",
) =>
	run(
		writeRelationshipMutations([
			{
				resourceType: "asset",
				resourceId: assetId,
				relation,
				subjectType: "user",
				subjectId: userId,
				operation,
			},
		]),
	);

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
		withAttachmentParts(
			[
				message,
			],
			reader,
		),
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
				size: 128,
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

		const [before] = await attachmentPartsOf(message, {
			userId: viewer,
			zedToken: shared.zedToken,
		});
		expect(before).toMatchObject({
			type: "file",
			mediaType: "image/png",
		});
		expect(before.type === "file" && before.url).toContain(
			`${asset.prefix}/${asset.id}.png`,
		);

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
});
