import { type AssetId, buckets, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	buildStoredExtractionKey,
	extract,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getMimeTypeFromFileType } from "@orcai/s3";
import { getImageAsBase64, getObjectAsJson } from "@orcai/s3/server";
import type { ChatAttachmentRef, ChatMessageAttachment } from "@orcai/schema";
import type { FileUIPart, TextUIPart } from "ai";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { readableIds } from "@/lib/authz/content-access";
import { permissionDenied } from "@/lib/orpc/middlewares/permission";
import { unique } from "@/lib/utils/array-utils";
import {
	CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH,
	CHAT_ATTACHMENT_MAX_IMAGE_BYTES,
} from "@/settings/constants";

type Reader = {
	userId: UserId;
	zedToken: string | undefined;
};

type AttachedAsset = Pick<
	typeof dbSchema.asset.$inferSelect,
	"id" | "bucket" | "prefix" | "title" | "fileType" | "size"
> & {
	mediaType: string;
};

type AttachmentPart = FileUIPart | TextUIPart;

/** The assets among `assetIds` the reader may read, by id. */
const readableAssets = (assetIds: readonly AssetId[], reader: Reader) =>
	Effect.gen(function* () {
		const permitted = yield* readableIds("asset", assetIds, reader);
		if (permitted.size === 0) return new Map<AssetId, AttachedAsset>();

		const rows = yield* (yield* DB)
			.select({
				id: dbSchema.asset.id,
				bucket: dbSchema.asset.bucket,
				prefix: dbSchema.asset.prefix,
				title: dbSchema.asset.title,
				fileType: dbSchema.asset.fileType,
				size: dbSchema.asset.size,
			})
			.from(dbSchema.asset)
			.where(
				inArray(dbSchema.asset.id, [
					...permitted,
				]),
			);
		return new Map(
			rows.map(
				(
					row,
				): [
					AssetId,
					AttachedAsset,
				] => [
					row.id,
					{
						...row,
						mediaType: getMimeTypeFromFileType(row.fileType),
					},
				],
			),
		);
	});

/**
 * What a new message stores of its attachments, read from their assets.
 * Fails when the sender cannot read one of them.
 */
export const attachAssets = (
	refs: readonly ChatAttachmentRef[],
	reader: Reader,
) =>
	Effect.gen(function* () {
		const assetIds = unique(refs.map((ref) => ref.assetId));
		if (assetIds.length === 0) return [];

		const assets = yield* readableAssets(assetIds, reader);
		const denied = assetIds.find((assetId) => !assets.has(assetId));
		if (denied !== undefined) {
			return yield* Effect.fail(
				permissionDenied({
					entityType: "asset",
					permission: "read",
					zedToken: reader.zedToken,
				}),
			);
		}

		return assetIds.map((assetId): ChatMessageAttachment => {
			const asset = assets.get(assetId) as AttachedAsset;
			return {
				assetId,
				title: asset.title,
				fileType: asset.mediaType,
				size: asset.size,
			};
		});
	});

const objectKey = (asset: AttachedAsset) =>
	`${asset.prefix}/${asset.id}.${asset.fileType}`;

const truncateText = (
	text: string,
	limit = CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH,
) => (text.length <= limit ? text : `${text.slice(0, limit)}\n\n[Truncated]`);

const notePart = (text: string): AttachmentPart => ({
	type: "text",
	text,
});

// Inline data, so the model never fetches a signed URL.
const filePart = (asset: AttachedAsset) =>
	getImageAsBase64({
		bucket: asset.bucket,
		name: objectKey(asset),
	}).pipe(
		Effect.map(
			(base64): AttachmentPart => ({
				type: "file",
				mediaType: asset.mediaType,
				filename: asset.title,
				url: `data:${asset.mediaType};base64,${base64}`,
			}),
		),
	);

const documentPart = (asset: AttachedAsset) =>
	Effect.gen(function* () {
		const stored = yield* getObjectAsJson<StoredExtractionArtifact>({
			bucket: buckets.processed.name,
			name: buildStoredExtractionKey(asset.id),
		}).pipe(Effect.option);

		const content =
			stored._tag === "Some"
				? stored.value.content.trim()
				: (yield* extract(
						{
							kind: "s3",
							bucket: asset.bucket,
							key: objectKey(asset),
							mimeType: asset.mediaType,
							filename: asset.title,
						},
						{
							profile: "chat-light",
						},
					)).content.trim();

		if (content.length === 0) {
			return notePart(`Attachment "${asset.title}" could not be loaded.`);
		}

		return notePart(
			[
				`Attached document: ${asset.title}`,
				`Media type: ${asset.mediaType}`,
				"Extracted content:",
				truncateText(content),
			].join("\n\n"),
		);
	});

const promptPart = (asset: AttachedAsset) =>
	(asset.mediaType.startsWith("image/")
		? filePart(asset)
		: documentPart(asset)
	).pipe(
		Effect.catch((error) =>
			Effect.logError("chat attachment could not be loaded", error).pipe(
				Effect.annotateLogs({
					assetId: asset.id,
					fileType: asset.fileType,
				}),
				Effect.as(notePart(`Attachment "${asset.title}" could not be loaded.`)),
			),
		),
	);

/**
 * User messages with their attachments as parts the model reads. An
 * attachment the reader can no longer read, or whose asset is gone, becomes a
 * note saying so, as do images past the turn's image budget.
 */
export const withAttachmentParts = (
	messages: ChatAgentUIMessage[],
	reader: Reader,
) =>
	Effect.gen(function* () {
		const attachmentsOf = (message: ChatAgentUIMessage) =>
			message.role === "user" ? (message.attachments ?? []) : [];
		// Newest first, so the image budget goes to the latest attachments.
		const assetIds = unique(
			[
				...messages,
			]
				.reverse()
				.flatMap((message) =>
					attachmentsOf(message).map((attachment) => attachment.assetId),
				),
		);
		if (assetIds.length === 0) return messages;

		const assets = yield* readableAssets(assetIds, reader);
		const parts = new Map<AssetId, AttachmentPart>();
		let imageBytes = 0;
		const loaded = assetIds
			.flatMap((assetId) => assets.get(assetId) ?? [])
			.filter((asset) => {
				if (!asset.mediaType.startsWith("image/")) return true;
				imageBytes += asset.size;
				if (imageBytes <= CHAT_ATTACHMENT_MAX_IMAGE_BYTES) return true;
				parts.set(
					asset.id,
					notePart(
						`Attachment "${asset.title}" is left out to keep the request small.`,
					),
				);
				return false;
			});
		yield* Effect.forEach(
			loaded,
			(asset) =>
				promptPart(asset).pipe(
					Effect.tap((part) => Effect.sync(() => parts.set(asset.id, part))),
				),
			{
				concurrency: 3,
				discard: true,
			},
		);

		return messages.map((message): ChatAgentUIMessage => {
			const attachments = attachmentsOf(message);
			return attachments.length === 0
				? message
				: {
						...message,
						parts: [
							...message.parts,
							...attachments.map(
								(attachment) =>
									parts.get(attachment.assetId) ??
									notePart(
										`Attachment "${attachment.title}" is no longer available.`,
									),
							),
						],
					};
		});
	});
