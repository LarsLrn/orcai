/** biome-ignore-all lint/style/noNonNullAssertion: <Mostly fighting typescript here> */
import type { UploadRouteName } from "@/lib/s3/upload-routes";
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
	route: UploadRouteName;
	signedUrls: SignedUrlsSuccessResponse;
	files: File[] | FileList;
	multipartBatchSize?: number;
	uploadBatchSize?: number;
	signal?: AbortSignal;

	onUploadBegin?: (data: {
		files: FileUploadInfo<"pending">[];
		metadata: ServerMetadata;
	}) => void;
	onFileStateChange?: (data: { file: FileUploadInfo<UploadStatus> }) => void;
	onMultipartComplete?: (data: {
		route: UploadRouteName;
		uploadId: string;
		file: SignedUrlsSuccessResponse["files"][number]["file"];
		parts: { etag: string; partNumber: number }[];
	}) => Promise<unknown>;
	onMultipartAbort?: (data: {
		route: UploadRouteName;
		uploadId: string;
		file: SignedUrlsSuccessResponse["files"][number]["file"];
	}) => Promise<unknown>;
}): Promise<DirectUploadResult<true>> {
	const files = Array.from(params.files);

	if (files.length === 0) {
		throw new ClientUploadErrorClass({
			type: "no_files",
			message: "No files to upload.",
		});
	}

	try {
		const signedUrls = params.signedUrls.files;
		const serverMetadata = params.signedUrls.metadata;

		if (!signedUrls || signedUrls.length === 0) {
			throw new ClientUploadErrorClass({
				type: "unknown",
				message:
					"No pre-signed URLs returned from server. Check your upload router config.",
			});
		}

		if (signedUrls.length !== files.length) {
			throw new ClientUploadErrorClass({
				type: "unknown",
				message: "Server returned an unexpected number of upload URLs.",
			});
		}

		const uploadsByIndex = signedUrls.map((url, index) => {
			const file = files[index];

			if (!file) {
				throw new ClientUploadErrorClass({
					type: "unknown",
					message: "Failed to map selected files to upload URLs.",
				});
			}

			return { file, url };
		});

		const uploads = new Map<string, FileUploadInfo<UploadStatus>>(
			uploadsByIndex.map(({ file, url }) => [
				url.file.objectKey,
				{
					status: "pending",
					progress: 0,
					raw: file,
					...url.file,
				},
			]),
		);

		const uploadPromises = uploadsByIndex.map(({ file, url }) => async () => {
			const isMultipart = url.mode === "multipart";

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
					if (!params.onMultipartComplete) {
						throw new Error("Missing multipart completion handler.");
					}

					const completedParts = await uploadMultipartFileToS3({
						file,
						parts: url.parts,
						partSize: url.partSize,
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

					await params.onMultipartComplete({
						route: params.route,
						uploadId: url.uploadId,
						file: url.file,
						parts: completedParts,
					});

					uploads.set(url.file.objectKey, {
						...uploads.get(url.file.objectKey)!,
						status: "complete",
						progress: 1,
					});

					params.onFileStateChange?.({
						file: uploads.get(url.file.objectKey)!,
					});
				} else {
					await uploadFileToS3({
						file,
						signedUrl: url.signedUrl,
						signedHeaders: "headers" in url ? url.headers : undefined,
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
					await params
						.onMultipartAbort?.({
							route: params.route,
							uploadId: url.uploadId,
							file: url.file,
						})
						.catch(() => null);
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
