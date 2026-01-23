import type { FileType } from "@/lib/s3/schema/file-schema";
import type { BucketName } from "@/settings/buckets";

export type FilePayload = {
	bucket: BucketName;
	prefix: string;
	id: string;
	type: FileType;
	expiry?: number;
};
