import { buckets } from "@orcai/core";
import type { BucketName } from "@orcai/schema";

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
		allowedMimePatterns: [
			"image/*",
			"video/*",
			"audio/*",
			"application/pdf",
			"text/*",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		],
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
