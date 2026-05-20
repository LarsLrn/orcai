import { buckets } from "@orcai/core";
import {
	buildStoredExtractionKey,
	extract,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getFileTypeFromMime } from "@orcai/s3";
import { getDownloadUrl, getObjectAsJson } from "@orcai/s3/server";
import type { FileUIPart, TextUIPart } from "ai";
import * as Effect from "effect/Effect";
import type { ChatAttachment } from "@/lib/ai/types/chat-attachment";
import { CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH } from "@/settings/constants";

const getObjectKey = (attachment: ChatAttachment) => {
	const extension = getFileTypeFromMime(attachment.fileType);
	return `${attachment.prefix}/${attachment.assetId}.${extension}`;
};

const truncateText = (
	text: string,
	limit = CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH,
) => (text.length <= limit ? text : `${text.slice(0, limit)}\n\n[Truncated]`);

const formatDocumentAttachmentText = (params: {
	title: string;
	fileType: string;
	content: string;
}) =>
	[
		`Attached document: ${params.title}`,
		`Media type: ${params.fileType}`,
		"Extracted content:",
		truncateText(params.content),
	].join("\n\n");

const buildFileAttachmentPart = (attachment: ChatAttachment) =>
	Effect.gen(function* () {
		const key = getObjectKey(attachment);
		const signedUrl = yield* getDownloadUrl({
			bucket: attachment.bucket,
			key,
			expiresIn: 60 * 30,
		});

		return {
			type: "file",
			mediaType: attachment.fileType,
			filename: attachment.title,
			url: signedUrl,
		} satisfies FileUIPart;
	});

const buildTextAttachmentPart = (attachment: ChatAttachment) =>
	Effect.gen(function* () {
		const storedExtraction = yield* getObjectAsJson<StoredExtractionArtifact>({
			bucket: buckets.processed.name,
			name: buildStoredExtractionKey(attachment.assetId),
		}).pipe(Effect.option);

		const content =
			storedExtraction._tag === "Some"
				? storedExtraction.value.content.trim()
				: (yield* extract(
						{
							kind: "s3",
							bucket: attachment.bucket,
							key: getObjectKey(attachment),
							mimeType: attachment.fileType,
							filename: attachment.title,
						},
						{
							profile: "chat-light",
						},
					)).content.trim();

		if (content.length === 0) {
			return fallbackAttachmentPart(attachment);
		}

		return {
			type: "text",
			text: formatDocumentAttachmentText({
				title: attachment.title,
				fileType: attachment.fileType,
				content,
			}),
		} satisfies TextUIPart;
	});

const fallbackAttachmentPart = (attachment: ChatAttachment) =>
	({
		type: "text",
		text: `Attachment "${attachment.title}" could not be loaded.`,
	}) satisfies TextUIPart;

const buildAttachmentPromptPart = (attachment: ChatAttachment) => {
	if (attachment.fileType.startsWith("image/")) {
		return buildFileAttachmentPart(attachment).pipe(
			Effect.map((part): FileUIPart | TextUIPart => part),
			Effect.catch(() => Effect.succeed(fallbackAttachmentPart(attachment))),
		);
	}

	return buildTextAttachmentPart(attachment).pipe(
		Effect.map((part): FileUIPart | TextUIPart => part),
		Effect.catch(() => Effect.succeed(fallbackAttachmentPart(attachment))),
	);
};

export const buildAttachmentPromptPartCached = (params: {
	attachment: ChatAttachment;
	cache: Map<string, FileUIPart | TextUIPart>;
}) =>
	Effect.gen(function* () {
		const cached = params.cache.get(params.attachment.assetId);
		if (cached) {
			return cached;
		}

		const part = yield* buildAttachmentPromptPart(params.attachment);

		params.cache.set(params.attachment.assetId, part);
		return part;
	});
