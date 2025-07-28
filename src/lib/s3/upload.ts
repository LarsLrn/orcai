/** biome-ignore-all lint/style/noNonNullAssertion: <Mostly fighting typescript here> */
import { uploadFileToS3, uploadMultipartFileToS3 } from "./s3-upload";
import { ClientUploadErrorClass } from "./types/error";
import type {
	DirectUploadResult,
	ServerMetadata,
	SignedUrlsSuccessResponse,
} from "./types/internal";
import type { FileUploadInfo, UploadStatus } from "./types/public";

/**
 * Upload multiple files to S3.
 *
 * This will not throw if one of the uploads fails, but will return the files that failed to upload.
 */
export async function uploadFiles(params: {
	signedUrls: SignedUrlsSuccessResponse;
	files: File[] | FileList;
	metadata?: ServerMetadata;
	multipartBatchSize?: number;
	uploadBatchSize?: number;
	signal?: AbortSignal;
	headers?: HeadersInit;

	onUploadBegin?: (data: {
		files: FileUploadInfo<"pending">[];
		metadata: ServerMetadata;
	}) => void;
	onFileStateChange?: (data: { file: FileUploadInfo<UploadStatus> }) => void;
}): Promise<DirectUploadResult<true>> {
	const files = Array.from(params.files);

	if (files.length === 0) {
		throw new ClientUploadErrorClass({
			type: "no_files",
			message: "No files to upload.",
		});
	}

	try {
		const signedUrls =
			"multipart" in params.signedUrls
				? params.signedUrls.multipart.files
				: params.signedUrls.files;
		const serverMetadata = params.signedUrls.metadata;
		const partSize =
			"multipart" in params.signedUrls
				? params.signedUrls.multipart.partSize
				: 0;

		if (!signedUrls || signedUrls.length === 0) {
			throw new ClientUploadErrorClass({
				type: "unknown",
				message:
					"No pre-signed URLs returned from server. Check your upload router config.",
			});
		}

		const uploads = new Map<string, FileUploadInfo<UploadStatus>>(
			signedUrls.map((url) => [
				url.file.objectKey,
				{
					status: "pending",
					progress: 0,
					raw: files.find(
						(file) =>
							file.name === url.file.name &&
							file.size === url.file.size &&
							file.type === url.file.type,
					)!,
					...url.file,
				},
			]),
		);

		const uploadPromises = files.map((file) => async () => {
			const url = signedUrls.find(
				(item) =>
					item.file.name === file.name &&
					item.file.size === file.size &&
					item.file.type === file.type,
			)!;

			const isMultipart = "parts" in url;

			try {
				uploads.set(url.file.objectKey, {
					...uploads.get(url.file.objectKey)!,
					status: "uploading",
					progress: 0,
				});

				params.onFileStateChange?.({
					file: uploads.get(url.file.objectKey)!,
				});

				if (isMultipart) {
					await uploadMultipartFileToS3({
						file,
						parts: url.parts,
						partSize,
						uploadId: url.uploadId,
						completeSignedUrl: url.completeSignedUrl,
						partsBatchSize: params.multipartBatchSize,
						signal: params.signal,
						onProgress: (progress) => {
							uploads.set(url.file.objectKey, {
								...uploads.get(url.file.objectKey)!,
								status: progress === 1 ? "complete" : "uploading",
								progress,
							});

							params.onFileStateChange?.({
								file: uploads.get(url.file.objectKey)!,
							});
						},
					});
				} else {
					await uploadFileToS3({
						file,
						signedUrl: url.signedUrl,
						objectMetadata: url.file.objectMetadata,
						signal: params.signal,
						onProgress: (progress) => {
							uploads.set(url.file.objectKey, {
								...uploads.get(url.file.objectKey)!,
								status: progress === 1 ? "complete" : "uploading",
								progress,
							});

							params.onFileStateChange?.({
								file: uploads.get(url.file.objectKey)!,
							});
						},
					});
				}
			} catch {
				if (isMultipart) {
					await fetch(url.abortSignedUrl, {
						method: "DELETE",
					}).catch(() => null);
				}

				uploads.set(url.file.objectKey, {
					...uploads.get(url.file.objectKey)!,
					status: "failed",
					error: {
						type: "s3_upload",
						message: "Failed to upload file to S3.",
					},
				});

				params.onFileStateChange?.({
					file: uploads.get(url.file.objectKey)!,
				});
			}
		});

		params.onUploadBegin?.({
			files: Array.from(uploads.values()) as FileUploadInfo<"pending">[],
			metadata: serverMetadata,
		});

		uploads.forEach((file) => {
			params.onFileStateChange?.({
				file,
			});
		});

		const batchSize = params.uploadBatchSize || files.length;
		for (let i = 0; i < uploadPromises.length; i += batchSize) {
			await Promise.all(
				uploadPromises.slice(i, i + batchSize).map((fn) => fn()),
			);
		}

		return {
			files: Array.from(uploads.values()).filter(
				(file) => file.status === "complete",
			) as FileUploadInfo<"complete">[],
			failedFiles: Array.from(uploads.values()).filter(
				(file) => file.status === "failed",
			) as FileUploadInfo<"failed">[],
			metadata: serverMetadata,
		};
	} catch (error) {
		if (error instanceof ClientUploadErrorClass) {
			throw error;
		}
		if (error instanceof Error) {
			throw new ClientUploadErrorClass({
				type: "unknown",
				message: error.message,
			});
		}
		throw new ClientUploadErrorClass({
			type: "unknown",
			message: "Failed to upload files.",
		});
	}
}

/**
 * Upload a single file to S3.
 *
 * This will throw if the upload fails.
 */
export async function uploadFile(params: {
	signedUrls: SignedUrlsSuccessResponse;
	route: string;
	file: File;
	metadata?: ServerMetadata;
	multipartBatchSize?: number;
	signal?: AbortSignal;
	headers?: HeadersInit;

	onUploadBegin?: (data: {
		file: FileUploadInfo<"pending">;
		metadata: ServerMetadata;
	}) => void;
	onFileStateChange?: (data: { file: FileUploadInfo<UploadStatus> }) => void;
}): Promise<DirectUploadResult<false>> {
	const { files, metadata } = await uploadFiles({
		signedUrls: params.signedUrls,
		files: [params.file],
		metadata: params.metadata,
		multipartBatchSize: params.multipartBatchSize,
		signal: params.signal,
		headers: params.headers,
		onUploadBegin: (data) => {
			params.onUploadBegin?.({
				file: data.files[0]!,
				metadata: data.metadata,
			});
		},
		onFileStateChange: params.onFileStateChange,
	});

	const file = files[0];

	if (!file) {
		throw new ClientUploadErrorClass({
			type: "unknown",
			message: "Failed to upload file.",
		});
	}

	return {
		file,
		metadata,
	};
}
