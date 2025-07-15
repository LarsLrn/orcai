import type { BucketName } from "@/settings/buckets";

export type FileType =
	| "pdf"
	| "jpeg"
	| "png"
	| "docx"
	| "pptx"
	| "md"
	| "unknown";

export type FilePayload = {
	bucket: BucketName;
	prefix: string;
	id: string;
	type: FileType;
	expiry?: number;
};
