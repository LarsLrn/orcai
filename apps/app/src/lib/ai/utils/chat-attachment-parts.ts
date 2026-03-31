import { DoclingService, serializeDoclingPayloadToMarkdown } from "@orcai/ai";
import { getFileTypeFromMime } from "@orcai/s3";
import {
	getDownloadUrl,
	S3Error,
	sendGetObjectCommand,
} from "@orcai/s3/server";
import type { FileUIPart, TextUIPart } from "ai";
import * as Effect from "effect/Effect";
import type { ChatAttachment } from "@/lib/ai/types/chat-attachment";
import {
	CHAT_ATTACHMENT_DOCUMENT_MIME_TYPES,
	CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH,
} from "@/settings/constants";

const getObjectKey = (attachment: ChatAttachment) => {
	const extension = getFileTypeFromMime(attachment.fileType);
	return `${attachment.prefix}/${attachment.assetId}.${extension}`;
};

const getObjectBytes = (attachment: ChatAttachment) =>
	Effect.gen(function* () {
		const key = getObjectKey(attachment);
		const object = yield* sendGetObjectCommand({
			bucket: attachment.bucket,
			key,
		});

		const body = yield* Effect.fromNullable(object.Body).pipe(
			Effect.orElseFail(
				() =>
					new S3Error({
						operation: "chatAttachmentParts.getObjectBytes",
						cause: "empty_body",
					}),
			),
		);

		return yield* Effect.tryPromise({
			try: () => body.transformToByteArray(),
			catch: (cause) =>
				new S3Error({
					operation: "chatAttachmentParts.getObjectBytes",
					cause,
				}),
		});
	});

const truncateText = (
	text: string,
	limit = CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH,
) => (text.length <= limit ? text : `${text.slice(0, limit)}\n\n[Truncated]`);

const formatAttachmentTextPart = (attachment: ChatAttachment, text: string) =>
	({
		type: "text",
		text: [
			`Attachment: ${attachment.title}`,
			`Type: ${attachment.fileType}`,
			"",
			truncateText(text.trim()),
		]
			.filter(Boolean)
			.join("\n"),
	}) satisfies TextUIPart;

const convertDocumentToMarkdown = ({
	attachment,
	buffer,
}: {
	attachment: ChatAttachment;
	buffer: Uint8Array;
}) =>
	Effect.gen(function* () {
		const { convertDocument } = yield* DoclingService;
		const payload = yield* convertDocument({
			document: buffer,
			filename: attachment.title,
			timeout: 2 * 60 * 1000,
			extractTablesAsImages: false,
		});

		return serializeDoclingPayloadToMarkdown(payload, {
			keepImageRefs: false,
			keepHeader: false,
			keepFooter: false,
			keepMarkdownTables: true,
		});
	});

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
		const bytes = yield* getObjectBytes(attachment);

		if (attachment.fileType.startsWith("text/")) {
			const text = Buffer.from(bytes).toString("utf-8");
			return formatAttachmentTextPart(attachment, text);
		}

		if (CHAT_ATTACHMENT_DOCUMENT_MIME_TYPES.has(attachment.fileType)) {
			const markdown = yield* convertDocumentToMarkdown({
				attachment,
				buffer: bytes,
			});
			return formatAttachmentTextPart(attachment, markdown);
		}

		return {
			type: "text",
			text: `Attachment "${attachment.title}" (${attachment.fileType}) is available but could not be converted to text.`,
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
			Effect.catchAll(() => Effect.succeed(fallbackAttachmentPart(attachment))),
		);
	}

	return buildTextAttachmentPart(attachment).pipe(
		Effect.map((part): FileUIPart | TextUIPart => part),
		Effect.catchAll(() => Effect.succeed(fallbackAttachmentPart(attachment))),
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
