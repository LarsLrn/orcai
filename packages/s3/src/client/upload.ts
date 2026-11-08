import type { ServerMetadata } from "../shared/types";
import { ClientUploadErrorClass } from "./error";
import type { SignedUrlsSuccessResponse } from "./internal";
import type { DirectUploadResult, FileUploadInfo } from "./public";
import { uploadFileToS3, uploadMultipartFileToS3 } from "./s3-upload";

export async function uploadFiles<TRoute extends string>(params: {
	route: TRoute;
	signedUrls: SignedUrlsSuccessResponse;
	files: File[] | FileList;
	multipartBatchSize?: number;
	uploadBatchSize?: number;
	signal?: AbortSignal;
	onUploadBegin?: (data: {
		files: FileUploadInfo<"pending">[];
		metadata: ServerMetadata;
	}) => void;
	onFileStateChange?: (data: { file: FileUploadInfo }) => void;
	onMultipartComplete?: (data: {
		route: TRoute;
		uploadId: string;
		file: SignedUrlsSuccessResponse["files"][number]["file"];
		parts: {
			etag: string;
			partNumber: number;
		}[];
	}) => Promise<unknown>;
	onMultipartAbort?: (data: {
		route: TRoute;
		uploadId: string;
		file: SignedUrlsSuccessResponse["files"][number]["file"];
	}) => Promise<unknown>;
}): Promise<DirectUploadResult> {
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

		const targets = signedUrls.map((url, index) => {
			const file = files[index];

			if (!file) {
				throw new ClientUploadErrorClass({
					type: "unknown",
					message: "Failed to map selected files to upload URLs.",
				});
			}

			const pending: FileUploadInfo<"pending"> = {
				status: "pending",
				progress: 0,
				raw: file,
				...url.file,
			};

			return {
				file,
				url,
				pending,
			};
		});

		const uploads = new Map<string, FileUploadInfo>(
			targets.map(({ pending }) => [
				pending.objectKey,
				pending,
			]),
		);

		const uploadPromises = targets.map(({ file, url, pending }) => async () => {
			let current: FileUploadInfo = pending;
			const publish = (next: FileUploadInfo) => {
				current = next;
				uploads.set(next.objectKey, next);
				params.onFileStateChange?.({
					file: next,
				});
			};
			const onProgress = (progress: number) =>
				publish({
					...current,
					status: progress === 1 ? "complete" : "uploading",
					progress,
				});

			try {
				publish({
					...current,
					status: "uploading",
					progress: 0,
				});

				if (url.mode === "multipart") {
					if (!params.onMultipartComplete) {
						throw new Error("Missing multipart completion handler.");
					}

					const completedParts = await uploadMultipartFileToS3({
						file,
						parts: url.parts,
						partSize: url.partSize,
						partsBatchSize: params.multipartBatchSize,
						signal: params.signal,
						onProgress,
					});

					await params.onMultipartComplete({
						route: params.route,
						uploadId: url.uploadId,
						file: url.file,
						parts: completedParts,
					});

					publish({
						...current,
						status: "complete",
						progress: 1,
					});
				} else {
					await uploadFileToS3({
						file,
						signedUrl: url.signedUrl,
						signedHeaders: url.headers,
						signal: params.signal,
						onProgress,
					});
				}
			} catch (cause) {
				if (url.mode === "multipart") {
					await params
						.onMultipartAbort?.({
							route: params.route,
							uploadId: url.uploadId,
							file: url.file,
						})
						.catch(() => null);
				}

				publish({
					...current,
					status: "failed",
					error: {
						type: "s3_upload",
						message: "Failed to upload file to S3.",
						cause,
					},
				});
			}
		});

		params.onUploadBegin?.({
			files: targets.map(({ pending }) => pending),
			metadata: serverMetadata,
		});

		uploads.forEach((file) => {
			params.onFileStateChange?.({
				file,
			});
		});

		const batchSize = params.uploadBatchSize || files.length;
		for (let index = 0; index < uploadPromises.length; index += batchSize) {
			await Promise.all(
				uploadPromises.slice(index, index + batchSize).map((fn) => fn()),
			);
		}

		const settled = Array.from(uploads.values());
		return {
			files: settled.filter((file) => file.status === "complete"),
			failedFiles: settled.filter((file) => file.status === "failed"),
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
