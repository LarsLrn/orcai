import type { UploadRouteName } from "@/lib/s3/upload-routes";
import type {
	ClientUploadError,
	FileUploadInfo,
	UploadHookControl,
} from "./public";

export type ObjectMetadata = Record<string, string>;
export type ServerMetadata = Record<string, unknown>;

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

export type UploadHookProps<T extends boolean> = {
	/**
	 * The server-side upload route preset.
	 *
	 * @default "asset"
	 */
	route?: UploadRouteName;

	/**
	 * The number of parts that will be uploaded in parallel when uploading a file.
	 *
	 * **Only used in multipart uploads.**
	 *
	 * @default All parts at once.
	 */
	multipartBatchSize?: number;

	/**
	 * Callback that is called before requesting the pre-signed URLs. Use this to modify files before uploading them, like resizing or compressing.
	 *
	 * You can also throw an error to reject the file upload.
	 */
	onBeforeUpload?: (
		data: T extends true ? { files: File[] } : { file: File },
	) =>
		| void
		| (T extends true
				? // biome-ignore lint/suspicious/noConfusingVoidType: <This helps improve flexibility of the API>
					File[] | Promise<void | File[]>
				: // biome-ignore lint/suspicious/noConfusingVoidType: <This helps improve flexibility of the API>
					File | Promise<void | File>);

	/**
	 * Event that is called before the files start being uploaded to S3. This happens after the server responds with the pre-signed URL.
	 */
	onUploadBegin?: (
		data: {
			/**
			 * Metadata sent from the server.
			 */
			metadata: ServerMetadata;
		} & (T extends true
			? { files: FileUploadInfo<"pending">[] }
			: { file: FileUploadInfo<"pending"> }),
	) => void;

	/**
	 * Event that is called when a file upload progress changes.
	 */
	onUploadProgress?: (data: { file: FileUploadInfo<"uploading"> }) => void;

	/**
	 * Event that is called after files are successfully uploaded.
	 *
	 * This event is called even if some files fail to upload, but some succeed. This event is not called if all files fail to upload.
	 */
	onUploadComplete?: (
		data: {
			/**
			 * Metadata sent back from the server.
			 */
			metadata: ServerMetadata;
		} & (T extends true
			? {
					files: FileUploadInfo<"complete">[];
					failedFiles: FileUploadInfo<"failed">[];
				}
			: { file: FileUploadInfo<"complete"> }),
	) => void | Promise<void>;

	/**
	 * Event that is called after the upload settles (either successfully completed or an error occurs).
	 */
	onUploadSettle?: (
		data: {
			/**
			 * Metadata sent back from the server.
			 */
			metadata: ServerMetadata;
		} & (T extends true
			? {
					files: FileUploadInfo<"complete">[];
					failedFiles: FileUploadInfo<"failed">[];
				}
			: { file: FileUploadInfo<"complete"> }),
	) => void | Promise<void>;

	/**
	 * Abort signal to cancel the upload.
	 */
	signal?: AbortSignal;
} & (T extends true
	? {
			/**
			 * The size of the batch to upload files in parallel. Use `1` to upload files sequentially.
			 *
			 * By default, all files are uploaded in parallel.
			 */
			uploadBatchSize?: number;

			/**
			 * Event that is called after the entire upload if a file fails to upload.
			 *
			 * This event is called even if some files succeed to upload, but some fail. This event is not called if all files succeed.
			 */
			onUploadFail?: (data: {
				/**
				 * Metadata sent back from the server.
				 */
				metadata: ServerMetadata;

				succeededFiles: FileUploadInfo<"complete">[];
				failedFiles: FileUploadInfo<"failed">[];
			}) => void | Promise<void>;

			/**
			 * Event that is called if a critical error occurs before the upload to S3, and no files were able to be uploaded. For example, if your server is unreachable.
			 *
			 * Is also called some input is invalid. For example, if no files were selected.
			 */
			onError?: (error: ClientUploadError) => void;
		}
	: {
			/**
			 * Event that is called if the upload fails.
			 *
			 * Also called if some input is invalid. For example, if no files were selected.
			 */
			onError?: (error: ClientUploadError) => void;
		});

export type UploadHookReturn<T extends boolean> = UploadHookControl<T> & {
	control: UploadHookControl<T>;
};

export type DirectUploadResult<T extends boolean> = {
	/**
	 * Metadata sent back from the server.
	 */
	metadata: ServerMetadata;
} & (T extends true
	? {
			/**
			 * Files that were successfully uploaded.
			 */
			files: FileUploadInfo<"complete">[];

			/**
			 * Files that failed to upload.
			 */
			failedFiles: FileUploadInfo<"failed">[];
		}
	: {
			/**
			 * The file that was successfully uploaded.
			 */
			file: FileUploadInfo<"complete">;
		});
