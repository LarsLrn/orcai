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
};

export type UploadStatus = "pending" | "uploading" | "complete" | "failed";

export type FileUploadInfo<T extends UploadStatus> = {
	status: T;
	progress: number;
	objectKey: string;
	objectMetadata: ObjectMetadata;
	raw: File;
	name: string;
	size: number;
	type: string;
} & (T extends "failed"
	? {
			error: ClientUploadError;
		}
	: object);

export type DirectUploadResult<T extends boolean> = {
	metadata: ServerMetadata;
} & (T extends true
	? {
			files: FileUploadInfo<"complete">[];
			failedFiles: FileUploadInfo<"failed">[];
		}
	: {
			file: FileUploadInfo<"complete">;
		});

export type UploadHookControl<T extends boolean> = {
	metadata: ServerMetadata;
	isError: boolean;
	error: ClientUploadError | null;
	isPending: boolean;
	isSettled: boolean;
	reset: () => void;
	uploadAsync: (
		input: T extends true ? File[] | FileList : File,
		options?: {
			metadata?: ServerMetadata;
		},
	) => Promise<DirectUploadResult<T>>;
	upload: (
		input: T extends true ? File[] | FileList : File,
		options?: {
			metadata?: ServerMetadata;
		},
	) => Promise<DirectUploadResult<T>>;
} & (T extends true
	? {
			progresses: FileUploadInfo<UploadStatus>[];
			allSucceeded: boolean;
			hasFailedFiles: boolean;
			uploadedFiles: FileUploadInfo<"complete">[];
			failedFiles: FileUploadInfo<"failed">[];
			averageProgress: number;
		}
	: {
			progress: number;
			uploadedFile: FileUploadInfo<"complete"> | null;
			isSuccess: boolean;
		});
