import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { orpc } from "@/lib/orpc/orpc";
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

const CLIENT_UPLOAD_ERROR_TYPES = [
	"unknown",
	"invalid_request",
	"no_files",
	"s3_upload",
	"file_too_large",
	"invalid_file_type",
	"rejected",
	"too_many_files",
] as const satisfies ClientUploadError["type"][];

const isClientUploadErrorType = (
	type: unknown,
): type is ClientUploadError["type"] =>
	typeof type === "string" &&
	CLIENT_UPLOAD_ERROR_TYPES.includes(type as ClientUploadError["type"]);

const toClientUploadError = (error: unknown): ClientUploadError => {
	if (error instanceof ClientUploadErrorClass) {
		return {
			type: error.type,
			message: error.message,
		};
	}

	if (error instanceof Error) {
		const maybeErrorData = (
			error as Error & {
				data?: unknown;
			}
		).data as
			| {
					type?: unknown;
					message?: unknown;
			  }
			| undefined;

		if (maybeErrorData && isClientUploadErrorType(maybeErrorData.type)) {
			return {
				type: maybeErrorData.type,
				message:
					typeof maybeErrorData.message === "string"
						? maybeErrorData.message
						: error.message,
			};
		}

		return {
			type: "unknown",
			message: error.message,
		};
	}

	return {
		type: "unknown",
		message: "Failed to upload files.",
	};
};

const toStringMetadata = (metadata?: ServerMetadata) =>
	metadata
		? Object.fromEntries(
				Object.entries(metadata)
					.filter(([, value]) => typeof value === "string")
					.map(([key, value]) => [
						key,
						String(value),
					]),
			)
		: undefined;

const noFilesError = {
	type: "no_files",
	message: "No files to upload.",
} as const;

export function useUploadFiles({
	route = "asset",
	uploadBatchSize,
	multipartBatchSize,
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
		orpc.storage.createUploadUrls.mutationOptions(),
	);
	const { mutateAsync: completeMultipartUpload } = useMutation(
		orpc.storage.completeMultipartUpload.mutationOptions(),
	);
	const { mutateAsync: abortMultipartUpload } = useMutation(
		orpc.storage.abortMultipartUpload.mutationOptions(),
	);

	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<ClientUploadError | null>(null);

	const uploadsArray = useMemo(
		() => Array.from(uploads.values()),
		[
			uploads,
		],
	);
	const uploadedFiles = useMemo(
		() =>
			uploadsArray.filter(
				(file) => file.status === "complete",
			) as FileUploadInfo<"complete">[],
		[
			uploadsArray,
		],
	);
	const failedFiles = useMemo(
		() =>
			uploadsArray.filter(
				(file) => file.status === "failed",
			) as FileUploadInfo<"failed">[],
		[
			uploadsArray,
		],
	);
	const allSucceeded = useMemo(
		() =>
			uploadsArray.length > 0 &&
			uploadsArray.every((file) => file.status === "complete"),
		[
			uploadsArray,
		],
	);
	const hasFailedFiles = useMemo(
		() => uploadsArray.some((file) => file.status === "failed"),
		[
			uploadsArray,
		],
	);
	const isSettled = useMemo(
		() =>
			uploadsArray.length > 0 &&
			uploadsArray.every(
				(file) => file.status === "complete" || file.status === "failed",
			),
		[
			uploadsArray,
		],
	);
	const averageProgress = useMemo(() => {
		if (uploadsArray.length === 0) {
			return 0;
		}

		return (
			uploadsArray.reduce((acc, file) => acc + file.progress, 0) /
			uploadsArray.length
		);
	}, [
		uploadsArray,
	]);

	const reset = useCallback(() => {
		setUploads(new Map<string, FileUploadInfo<UploadStatus>>());
		setServerMetadata({});
		setIsPending(false);
		setError(null);
	}, []);

	const uploadAsync = useCallback(
		async (
			files: File[] | FileList,
			{
				metadata,
			}: {
				metadata?: ServerMetadata;
			} = {},
		) => {
			reset();

			setIsPending(true);

			const fileArray = Array.from(files);

			if (fileArray.length === 0) {
				onError?.(noFilesError);
				setError(noFilesError);
				throw new ClientUploadErrorClass(noFilesError);
			}

			try {
				let filesToUpload = fileArray;

				if (onBeforeUpload) {
					const callbackResult = await onBeforeUpload({
						files: fileArray,
					});

					if (Array.isArray(callbackResult)) {
						if (callbackResult.length === 0) {
							onError?.(noFilesError);
							setError(noFilesError);
							throw new ClientUploadErrorClass(noFilesError);
						}

						filesToUpload = callbackResult;
					}
				}

				const signedUrls = await getPresignedUrls({
					route,
					files: filesToUpload.map((file) => ({
						name: file.name,
						size: file.size,
						type: file.type,
					})),
					metadata: toStringMetadata(metadata),
				});

				const result = await uploadFiles({
					route,
					signedUrls: {
						metadata: signedUrls.metadata,
						files: signedUrls.data,
					},
					files: filesToUpload,
					uploadBatchSize,
					multipartBatchSize,
					signal,
					onUploadBegin,
					onMultipartComplete: (data) =>
						completeMultipartUpload({
							route: data.route,
							uploadId: data.uploadId,
							file: data.file,
							parts: data.parts,
						}),
					onMultipartAbort: (data) =>
						abortMultipartUpload({
							route: data.route,
							uploadId: data.uploadId,
							file: data.file,
						}),
					onFileStateChange: ({ file }) => {
						setUploads((prev) => new Map(prev).set(file.objectKey, file));

						if (file.status === "uploading") {
							onUploadProgress?.({
								file: file as FileUploadInfo<"uploading">,
							});
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
				await onUploadSettle?.({
					files: [],
					failedFiles: [],
					metadata: {},
				});

				const clientError = toClientUploadError(error);
				const uploadError = new ClientUploadErrorClass(clientError);

				onError?.(clientError);
				setError(clientError);
				throw uploadError;
			}
		},
		[
			route,
			getPresignedUrls,
			uploadBatchSize,
			multipartBatchSize,
			signal,
			onError,
			onBeforeUpload,
			onUploadBegin,
			onUploadComplete,
			onUploadFail,
			onUploadProgress,
			onUploadSettle,
			completeMultipartUpload,
			abortMultipartUpload,
			reset,
		],
	);

	const control = useMemo(
		() => ({
			uploadAsync,
			upload: uploadAsync,
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
