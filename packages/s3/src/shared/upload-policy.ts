import { buckets } from "@orcai/core";
import type { BucketName, FileType } from "@orcai/schema";

type UploadFileTypeDefinition = {
	fileType: Exclude<FileType, "unknown">;
	mimeType: string;
	aliases?: readonly string[];
};

const PROCESSABLE_ASSET_FILE_TYPES: readonly UploadFileTypeDefinition[] = [
	{
		fileType: "jpeg",
		mimeType: "image/jpeg",
		aliases: [
			"image/jpg",
		],
	},
	{
		fileType: "jpg",
		mimeType: "image/jpeg",
	},
	{
		fileType: "png",
		mimeType: "image/png",
	},
	{
		fileType: "gif",
		mimeType: "image/gif",
	},
	{
		fileType: "webp",
		mimeType: "image/webp",
	},
	{
		fileType: "pdf",
		mimeType: "application/pdf",
	},
	{
		fileType: "txt",
		mimeType: "text/plain",
	},
	{
		fileType: "csv",
		mimeType: "text/csv",
	},
	{
		fileType: "md",
		mimeType: "text/markdown",
	},
	{
		fileType: "doc",
		mimeType: "application/msword",
		aliases: [
			"application/x-msword",
		],
	},
	{
		fileType: "docx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	{
		fileType: "xls",
		mimeType: "application/vnd.ms-excel",
		aliases: [
			"application/msexcel",
			"application/x-msexcel",
			"application/x-ms-excel",
		],
	},
	{
		fileType: "xlsx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	},
	{
		fileType: "ppt",
		mimeType: "application/vnd.ms-powerpoint",
		aliases: [
			"application/mspowerpoint",
			"application/powerpoint",
			"application/x-mspowerpoint",
		],
	},
	{
		fileType: "pptx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	},
];

export const ASSET_UPLOAD_MIME_TYPES = [
	...new Set(
		PROCESSABLE_ASSET_FILE_TYPES.flatMap((definition) => [
			definition.mimeType,
			...(definition.aliases ?? []),
		]),
	),
] as readonly string[];

export const ASSET_UPLOAD_ACCEPT = PROCESSABLE_ASSET_FILE_TYPES.reduce(
	(accept, definition) => {
		const extension = `.${definition.fileType}`;
		for (const mimeType of [
			definition.mimeType,
			...(definition.aliases ?? []),
		]) {
			accept[mimeType] = [
				...(accept[mimeType] ?? []),
				extension,
			];
		}

		return accept;
	},
	{} as Record<string, string[]>,
);

export const UPLOAD_ROUTES = {
	asset: {
		bucket: buckets.main.name,
		maxFiles: 100,
		maxFileSize: 64 * 1024 * 1024,
		signedUrlExpiresIn: 60 * 30,
		multipart: {
			mode: "auto",
			thresholdSize: 10 * 1024 * 1024,
			partSize: 10 * 1024 * 1024,
			partSignedUrlExpiresIn: 60 * 30,
		},
		allowedMimePatterns: ASSET_UPLOAD_MIME_TYPES,
	},
	chatAttachment: {
		bucket: buckets.main.name,
		maxFiles: 8,
		maxFileSize: 25 * 1024 * 1024,
		signedUrlExpiresIn: 60 * 15,
		multipart: {
			mode: "auto",
			thresholdSize: 10 * 1024 * 1024,
			partSize: 10 * 1024 * 1024,
			partSignedUrlExpiresIn: 60 * 15,
		},
		allowedMimePatterns: [
			"image/*",
			"application/pdf",
			"text/*",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		],
	},
} as const satisfies Record<
	string,
	{
		bucket: BucketName;
		maxFiles: number;
		maxFileSize: number;
		signedUrlExpiresIn: number;
		multipart: {
			mode: "off" | "auto" | "always";
			thresholdSize: number;
			partSize: number;
			partSignedUrlExpiresIn: number;
		};
		allowedMimePatterns: readonly string[];
	}
>;

export type UploadRouteName = keyof typeof UPLOAD_ROUTES;

export const isMimeAllowed = (params: {
	mimeType: string;
	allowedMimePatterns: readonly string[];
}) => {
	if (params.allowedMimePatterns.length === 0) {
		return true;
	}

	return params.allowedMimePatterns.some((pattern) => {
		if (pattern.endsWith("/*")) {
			const prefix = pattern.slice(0, -1);
			return params.mimeType.startsWith(prefix);
		}

		return params.mimeType === pattern;
	});
};

export const buildUploadPrefix = (params: {
	userId: string;
	route: UploadRouteName;
}) => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");

	return `users/${params.userId}/${params.route}/${year}/${month}`;
};

export const shouldUseMultipartUpload = (params: {
	route: UploadRouteName;
	fileSize: number;
}) => {
	const config = UPLOAD_ROUTES[params.route].multipart;
	const mode = config.mode as "off" | "auto" | "always";

	if (mode === "off") {
		return false;
	}

	if (mode === "always") {
		return true;
	}

	return params.fileSize >= config.thresholdSize;
};
