import type { ObjectMetadata, ServerMetadata } from "../shared/types";

export type ClientUploadError = {
	type:
		| "unknown"
		| "invalid_request"
		| "no_files"
		| "s3_upload"
		| "file_too_large"
		| "invalid_file_type"
		| "rejected"
		| "too_many_files";
	message: string;
	cause?: unknown;
};

type UploadStatus = "pending" | "uploading" | "complete" | "failed";

type FileUploadDetails = {
	progress: number;
	objectKey: string;
	objectMetadata: ObjectMetadata;
	raw: File;
	name: string;
	size: number;
	type: string;
};

/** One file's upload as a union over `status`; only failed uploads carry an error. */
export type FileUploadInfo<T extends UploadStatus = UploadStatus> = {
	[S in T]: FileUploadDetails & {
		status: S;
	} & (S extends "failed"
			? {
					error: ClientUploadError;
				}
			: unknown);
}[T];

export type DirectUploadResult = {
	metadata: ServerMetadata;
	files: FileUploadInfo<"complete">[];
	failedFiles: FileUploadInfo<"failed">[];
};

export type UploadHookControl = {
	metadata: ServerMetadata;
	isError: boolean;
	error: ClientUploadError | null;
	isPending: boolean;
	isSettled: boolean;
	reset: () => void;
	uploadAsync: (
		input: File[] | FileList,
		options?: {
			metadata?: ServerMetadata;
		},
	) => Promise<DirectUploadResult>;
	upload: (
		input: File[] | FileList,
		options?: {
			metadata?: ServerMetadata;
		},
	) => Promise<DirectUploadResult>;
	progresses: FileUploadInfo[];
	allSucceeded: boolean;
	hasFailedFiles: boolean;
	uploadedFiles: FileUploadInfo<"complete">[];
	failedFiles: FileUploadInfo<"failed">[];
	averageProgress: number;
};
