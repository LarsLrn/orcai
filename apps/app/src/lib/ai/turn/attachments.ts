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
import { sourceRef } from "@/lib/ai/citations/source-ref";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { dataTag } from "@/lib/ai/utils/data-tag";
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

/** What an attachment adds to its message for the model. */
type BuiltAttachment = {
	parts: AttachmentPart[];
	/** The file's text was cut, so the model read only its start. */
	truncated?: boolean;
};

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

const isTruncated = (content: string) =>
	content.length > CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH;

const textPart = (text: string): AttachmentPart => ({
	type: "text",
	text,
});

/** An attachment that reaches the model as a note instead, which carries no ref. */
const note = (text: string): BuiltAttachment => ({
	parts: [
		textPart(text),
	],
});

type TaggedAsset = {
	id: string;
	title: string;
	mediaType: string;
};

/** The tag the system prompt calls data, with the ref that cites the attachment. */
const attachmentTag = ({ id, title, mediaType }: TaggedAsset, text: string) =>
	dataTag(
		"attachment",
		{
			ref: sourceRef("attachment", id),
			title,
			"media-type": mediaType,
		},
		text,
	);

/** A file's text in its attachment tag. */
export const attachmentText = (asset: TaggedAsset, content: string) =>
	attachmentTag(asset, truncateText(content));

// Inline data, so the model never fetches a signed URL.
const imageAttachment = (asset: AttachedAsset) =>
	getImageAsBase64({
		bucket: asset.bucket,
		name: objectKey(asset),
	}).pipe(
		Effect.map(
			(base64): BuiltAttachment => ({
				parts: [
					textPart(attachmentTag(asset, "Image in the next part.")),
					{
						type: "file",
						mediaType: asset.mediaType,
						filename: asset.title,
						url: `data:${asset.mediaType};base64,${base64}`,
					},
				],
			}),
		),
	);

const documentAttachment = (asset: AttachedAsset) =>
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
			return note(`Attachment "${asset.title}" could not be loaded.`);
		}

		return {
			parts: [
				textPart(attachmentText(asset, content)),
			],
			truncated: isTruncated(content),
		} satisfies BuiltAttachment;
	});

const buildAttachment = (asset: AttachedAsset) =>
	(asset.mediaType.startsWith("image/")
		? imageAttachment(asset)
		: documentAttachment(asset)
	).pipe(
		Effect.catch((error) =>
			Effect.logError("chat attachment could not be loaded", error).pipe(
				Effect.annotateLogs({
					assetId: asset.id,
					fileType: asset.fileType,
				}),
				Effect.as(note(`Attachment "${asset.title}" could not be loaded.`)),
			),
		),
	);

/**
 * User messages with their attachments as parts the model reads, and the ones
 * whose text was cut marked `truncated`. An attachment the reader can no
 * longer read, or whose asset is gone, becomes a note saying so, as do images
 * past the turn's image budget.
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
		const built = new Map<AssetId, BuiltAttachment>();
		let imageBytes = 0;
		const loaded = assetIds
			.flatMap((assetId) => assets.get(assetId) ?? [])
			.filter((asset) => {
				if (!asset.mediaType.startsWith("image/")) return true;
				imageBytes += asset.size;
				if (imageBytes <= CHAT_ATTACHMENT_MAX_IMAGE_BYTES) return true;
				built.set(
					asset.id,
					note(
						`Attachment "${asset.title}" is left out to keep the request small.`,
					),
				);
				return false;
			});
		yield* Effect.forEach(
			loaded,
			(asset) =>
				buildAttachment(asset).pipe(
					Effect.tap((attachment) =>
						Effect.sync(() => built.set(asset.id, attachment)),
					),
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
						attachments: attachments.map((attachment) =>
							built.get(attachment.assetId)?.truncated
								? {
										...attachment,
										truncated: true,
									}
								: attachment,
						),
						parts: [
							...message.parts,
							...attachments.flatMap(
								(attachment) =>
									(
										built.get(attachment.assetId) ??
										note(
											`Attachment "${attachment.title}" is no longer available.`,
										)
									).parts,
							),
						],
					};
		});
	});
