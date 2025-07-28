import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { storageQueryOptions } from "@/lib/query-options/storage";
import { ClientUploadErrorClass } from "@/lib/s3/types/error";
import type {
	ServerMetadata,
	UploadHookProps,
	UploadHookReturn,
} from "@/lib/s3/types/internal";
import type {
	ClientUploadError,
	FileUploadInfo,
	UploadStatus,
} from "@/lib/s3/types/public";
import { uploadFiles } from "@/lib/s3/upload";

export function useUploadFiles({
	uploadBatchSize,
	multipartBatchSize,
	headers,
	signal,
	onError,
	onBeforeUpload,
	onUploadBegin,
	onUploadComplete,
	onUploadFail,
	onUploadProgress,
	onUploadSettle,
}: UploadHookProps<true>): UploadHookReturn<true> {
	const [uploads, setUploads] = useState(
		() => new Map<string, FileUploadInfo<UploadStatus>>(),
	);
	const [serverMetadata, setServerMetadata] = useState<ServerMetadata>({});

	const { mutateAsync: getPresignedUrls } = useMutation(
		storageQueryOptions.createUploadUrls(),
	);

	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<ClientUploadError | null>(null);

	const uploadsArray = useMemo(() => Array.from(uploads.values()), [uploads]);
	const uploadedFiles = useMemo(
		() =>
			uploadsArray.filter(
				(file) => file.status === "complete",
			) as FileUploadInfo<"complete">[],
		[uploadsArray],
	);
	const failedFiles = useMemo(
		() =>
			uploadsArray.filter(
				(file) => file.status === "failed",
			) as FileUploadInfo<"failed">[],
		[uploadsArray],
	);
	const allSucceeded = useMemo(
		() => uploadsArray.every((file) => file.status === "complete"),
		[uploadsArray],
	);
	const hasFailedFiles = useMemo(
		() => uploadsArray.some((file) => file.status === "failed"),
		[uploadsArray],
	);
	const isSettled = useMemo(
		() =>
			uploadsArray.every(
				(file) => file.status === "complete" || file.status === "failed",
			),
		[uploadsArray],
	);
	const averageProgress = useMemo(() => {
		if (uploadsArray.length === 0) {
			return 0;
		}

		return (
			uploadsArray.reduce((acc, file) => acc + file.progress, 0) /
			uploadsArray.length
		);
	}, [uploadsArray]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <TODO: Check later>
	const uploadAsync = useCallback(
		async (
			files: File[] | FileList,
			{ metadata }: { metadata?: ServerMetadata } = {},
		) => {
			reset();

			setIsPending(true);

			const fileArray = Array.from(files);

			if (fileArray.length === 0) {
				const error = {
					type: "no_files",
					message: "No files to upload.",
				} as const;

				onError?.(error);
				setError(error);
				throw new ClientUploadErrorClass(error);
			}

			try {
				let filesToUpload = fileArray;

				if (onBeforeUpload) {
					const callbackResult = await onBeforeUpload({ files: fileArray });

					if (Array.isArray(callbackResult)) {
						if (callbackResult.length === 0) {
							const error = {
								type: "no_files",
								message: "No files to upload.",
							} as const;

							onError?.(error);
							setError(error);
							throw new ClientUploadErrorClass(error);
						}

						filesToUpload = callbackResult;
					}
				}

				const signedUrls = await getPresignedUrls({
					files: filesToUpload.map((file) => ({
						name: file.name,
						size: file.size,
						type: file.type,
					})),
				});

				const result = await uploadFiles({
					signedUrls: {
						metadata: { test: "test" }, // Placeholder for metadata
						files: signedUrls.data,
					},
					files: filesToUpload,
					metadata,
					uploadBatchSize,
					multipartBatchSize,
					headers,
					signal,
					onUploadBegin,
					onFileStateChange: ({ file }) => {
						setUploads((prev) => new Map(prev).set(file.objectKey, file));

						if (file.status === "uploading") {
							onUploadProgress?.({ file: file as FileUploadInfo<"uploading"> });
						}
					},
				});

				if (result.files.length > 0) {
					await onUploadComplete?.(result);
				}

				if (result.failedFiles.length > 0) {
					await onUploadFail?.({
						succeededFiles: result.files,
						failedFiles: result.failedFiles,
						metadata: result.metadata,
					});
				}

				setIsPending(false);
				setServerMetadata(result.metadata);
				await onUploadSettle?.(result);

				return result;
			} catch (error) {
				setIsPending(false);
				await onUploadSettle?.({ files: [], failedFiles: [], metadata: {} });

				if (error instanceof ClientUploadErrorClass) {
					onError?.(error);
					setError(error);
					throw error;
				}
				if (error instanceof Error) {
					const _error = new ClientUploadErrorClass({
						type: "unknown",
						message: error.message,
					});

					onError?.(_error);
					setError(_error);
					throw _error;
				}
				const _error = new ClientUploadErrorClass({
					type: "unknown",
					message: "Failed to upload files.",
				});

				onError?.(_error);
				setError(_error);
				throw _error;
			}
		},
		[
			getPresignedUrls,
			uploadBatchSize,
			multipartBatchSize,
			headers,
			signal,
			onError,
			onBeforeUpload,
			onUploadBegin,
			onUploadComplete,
			onUploadFail,
			onUploadProgress,
			onUploadSettle,
		],
	);

	const upload = useCallback(
		async (
			files: File[] | FileList,
			options: { metadata?: ServerMetadata } = {},
		) => {
			try {
				const result = await uploadAsync(files, options);

				return result;
			} catch (error) {
				console.error("Upload failed:", error);
				return {
					files: [],
					failedFiles: [],
					metadata: {},
				};
			}
		},
		[uploadAsync],
	);

	const reset = useCallback(() => {
		setUploads(new Map<string, FileUploadInfo<UploadStatus>>());
		setServerMetadata({});
		setIsPending(false);
		setError(null);
	}, []);

	const control = useMemo(
		() => ({
			uploadAsync,
			upload,
			reset,
			progresses: uploadsArray,
			allSucceeded,
			hasFailedFiles,
			uploadedFiles,
			failedFiles,
			isSettled,
			averageProgress,
			isPending,
			isError: !!error,
			error,
			metadata: serverMetadata,
		}),
		[
			uploadAsync,
			upload,
			reset,
			uploadsArray,
			allSucceeded,
			hasFailedFiles,
			uploadedFiles,
			failedFiles,
			isSettled,
			averageProgress,
			isPending,
			error,
			serverMetadata,
		],
	);

	return {
		...control,
		control,
	};
}
