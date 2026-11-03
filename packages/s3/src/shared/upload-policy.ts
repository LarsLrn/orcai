import { buckets } from "@orcai/core";
import {
	ASSET_FILE_TYPES,
	type BucketName,
	type FileType,
	type StorageUploadRoute,
} from "@orcai/schema";
import { acceptFor } from "./file-types";

/** The browser crops pictures and logos to a small WebP; nothing else is stored. */
const IMAGE_UPLOAD_ROUTE = {
	bucket: buckets.main.name,
	maxFiles: 1,
	maxFileSize: 256 * 1024,
	signedUrlExpiresIn: 60 * 15,
	multipart: {
		mode: "off",
		thresholdSize: 0,
		partSize: 0,
		partSignedUrlExpiresIn: 0,
	},
	fileTypes: [
		"webp",
	],
} as const;

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
		fileTypes: ASSET_FILE_TYPES,
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
		fileTypes: [
			"jpeg",
			"jpg",
			"png",
			"gif",
			"webp",
			"pdf",
			"txt",
			"csv",
			"md",
			"docx",
			"pptx",
		],
	},
	profileImage: IMAGE_UPLOAD_ROUTE,
	organizationLogo: IMAGE_UPLOAD_ROUTE,
} as const satisfies Record<
	StorageUploadRoute,
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
		fileTypes: readonly Exclude<FileType, "unknown">[];
	}
>;

export type UploadRouteName = keyof typeof UPLOAD_ROUTES;

/** What the asset file picker offers. */
export const ASSET_UPLOAD_ACCEPT = acceptFor(UPLOAD_ROUTES.asset.fileTypes);

/** Uploads land here until an asset or image is made from them; lifecycle expires the rest. */
export const UPLOAD_STAGING_PREFIX = "staging/";

/** Where a new upload lands: `staging/users/<userId>/<route>/YYYY/MM`. */
export const buildUploadPrefix = (params: {
	userId: string;
	route: UploadRouteName;
}) => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");

	return `${UPLOAD_STAGING_PREFIX}users/${params.userId}/${params.route}/${year}/${month}`;
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
