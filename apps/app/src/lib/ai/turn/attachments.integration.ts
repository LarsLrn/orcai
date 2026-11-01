import { describe, expect, test } from "bun:test";
import {
	type AssetId,
	buckets,
	type ChatMessageId,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import { writeRelationshipMutations } from "@orcai/spice-db";
import {
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { sourceRef } from "@/lib/ai/citations/source-ref";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { attachAssets, withAttachmentParts } from "./attachments";

const runtime = integrationRuntime();

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	runtime.runPromise(
		effect.pipe(Effect.provide(S3Live)) as Effect.Effect<A, E, never>,
	);

const newUser = () => run(createUser().pipe(Effect.map((user) => user.id)));

// A 1x1 PNG.
const PIXEL =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** An image asset only its owner can read, and the token of that write. */
const privateImage = async (
	owner: UserId,
	{
		title = "Floor plan",
		size = 70,
	}: {
		title?: string;
		size?: number;
	} = {},
) => {
	const asset = await run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.insert(dbSchema.asset)
				.values({
					bucket: buckets.main.name,
					prefix: `users/${owner}/chatAttachment/2026/10`,
					title,
					fileType: "png",
					size,
					userId: owner,
				})
				.returning();
			yield* sendPutObjectCommand({
				bucket: row.bucket,
				key: `${row.prefix}/${row.id}.png`,
				body: Buffer.from(PIXEL, "base64"),
				contentType: "image/png",
			});
			return row;
		}),
	);
	const { zedToken } = await relate(asset.id, "owner", owner);
	return {
		asset,
		zedToken,
	};
};

/** Writes the tuple, and for a viewer the grant row reads are checked against too. */
const relate = (
	assetId: AssetId,
	relation: "owner" | "viewer",
	userId: UserId,
	operation: "create" | "delete" = "create",
) =>
	run(
		Effect.gen(function* () {
			if (relation === "viewer") {
				const db = yield* DB;
				if (operation === "create") {
					const { organization } = yield* createOrganization();
					yield* db.insert(dbSchema.resourceGrant).values({
						resourceType: "asset",
						resourceId: assetId,
						principalType: "user",
						principalId: userId,
						role: "viewer",
						organizationId: organization.id as OrganizationId,
						grantedBy: userId,
					});
				} else {
					yield* db
						.update(dbSchema.resourceGrant)
						.set({
							revokedAt: new Date(),
						})
						.where(
							and(
								eq(dbSchema.resourceGrant.resourceId, assetId),
								eq(dbSchema.resourceGrant.principalId, userId),
							),
						);
				}
			}
			return yield* writeRelationshipMutations([
				{
					resourceType: "asset",
					resourceId: assetId,
					relation,
					subjectType: "user",
					subjectId: userId,
					operation,
				},
			]);
		}),
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

	test("images past the turn's image budget become a note, oldest first", async () => {
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

		const prompt = await run(withAttachmentParts(history, reader));

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
	});
});
