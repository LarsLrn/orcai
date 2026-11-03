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

export type UploadHookProps<TRoute extends string> = {
	route?: TRoute;
	multipartBatchSize?: number;
	onBeforeUpload?: (data: {
		files: File[];
	}) => undefined | File[] | Promise<undefined | File[]>;
	onUploadBegin?: (data: {
		metadata: ServerMetadata;
		files: FileUploadInfo<"pending">[];
	}) => void;
	onUploadProgress?: (data: { file: FileUploadInfo<"uploading"> }) => void;
	onUploadComplete?: (data: {
		metadata: ServerMetadata;
		files: FileUploadInfo<"complete">[];
		failedFiles: FileUploadInfo<"failed">[];
	}) => void | Promise<void>;
	onUploadSettle?: (data: {
		metadata: ServerMetadata;
		files: FileUploadInfo<"complete">[];
		failedFiles: FileUploadInfo<"failed">[];
	}) => void | Promise<void>;
	uploadBatchSize?: number;
	onUploadFail?: (data: {
		metadata: ServerMetadata;
		succeededFiles: FileUploadInfo<"complete">[];
		failedFiles: FileUploadInfo<"failed">[];
	}) => void | Promise<void>;
	onError?: (error: ClientUploadError) => void;
};

export type UploadHookReturn = UploadHookControl & {
	control: UploadHookControl;
};
