import type { ObjectMetadata, ServerMetadata } from "../shared/types";
import type {
	ClientUploadError,
	FileUploadInfo,
	UploadHookControl,
} from "./public";

type UploadFileBase = {
	file: {
		objectKey: string;
		objectMetadata: ObjectMetadata;
		name: string;
		size: number;
		type: string;
	};
};

type SingleUploadFile = UploadFileBase & {
	mode: "single";
	signedUrl: string;
	headers?: Record<string, string>;
};

type MultipartUploadFile = UploadFileBase & {
	mode: "multipart";
	parts: {
		signedUrl: string;
		partNumber: number;
		size: number;
	}[];
	partSize: number;
	uploadId: string;
};

export type SignedUrlsSuccessResponse = {
	metadata: ServerMetadata;
	files: Array<SingleUploadFile | MultipartUploadFile>;
};

export type UploadHookProps<TRoute extends string, T extends boolean> = {
	route?: TRoute;
	multipartBatchSize?: number;
	onBeforeUpload?: (
		data: T extends true
			? {
					files: File[];
				}
			: {
					file: File;
				},
	) =>
		| undefined
		| (T extends true
				? File[] | Promise<undefined | File[]>
				: File | Promise<undefined | File>);
	onUploadBegin?: (
		data: {
			metadata: ServerMetadata;
		} & (T extends true
			? {
					files: FileUploadInfo<"pending">[];
				}
			: {
					file: FileUploadInfo<"pending">;
				}),
	) => void;
	onUploadProgress?: (data: { file: FileUploadInfo<"uploading"> }) => void;
	onUploadComplete?: (
		data: {
			metadata: ServerMetadata;
		} & (T extends true
			? {
					files: FileUploadInfo<"complete">[];
					failedFiles: FileUploadInfo<"failed">[];
				}
			: {
					file: FileUploadInfo<"complete">;
				}),
	) => void | Promise<void>;
	onUploadSettle?: (
		data: {
			metadata: ServerMetadata;
		} & (T extends true
			? {
					files: FileUploadInfo<"complete">[];
					failedFiles: FileUploadInfo<"failed">[];
				}
			: {
					file: FileUploadInfo<"complete">;
				}),
	) => void | Promise<void>;
	signal?: AbortSignal;
} & (T extends true
	? {
			uploadBatchSize?: number;
			onUploadFail?: (data: {
				metadata: ServerMetadata;
				succeededFiles: FileUploadInfo<"complete">[];
				failedFiles: FileUploadInfo<"failed">[];
			}) => void | Promise<void>;
			onError?: (error: ClientUploadError) => void;
		}
	: {
			onError?: (error: ClientUploadError) => void;
		});

export type UploadHookReturn<T extends boolean> = UploadHookControl<T> & {
	control: UploadHookControl<T>;
};
