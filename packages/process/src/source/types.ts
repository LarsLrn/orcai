import type { BucketName } from "@orcai/schema";

export type ProcessBytesSource = {
	readonly kind: "bytes";
	readonly data: Uint8Array;
	readonly mimeType: string;
	readonly filename?: string;
};

export type ProcessS3Source = {
	readonly kind: "s3";
	readonly bucket: BucketName;
	readonly key: string;
	readonly mimeType?: string | null;
	readonly filename?: string;
};

export type ProcessSource = ProcessBytesSource | ProcessS3Source;

export type MaterializedProcessFile = {
	readonly path: string;
	readonly mimeType: string | null;
	readonly filename?: string;
};
