import type { ServerMetadata, UploadRouteName } from "@orcai/s3";
import {
	type ClientUploadError,
	ClientUploadErrorClass,
	type FileUploadInfo,
	type UploadHookProps,
	type UploadHookReturn,
	type UploadStatus,
	uploadFiles,
} from "@orcai/s3/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	describeError,
	errorReasonOf,
	reasonMessageOf,
} from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const createNoFilesError = () =>
	({
		type: "no_files",
		message: m.assets_upload_no_files_error(),
	}) as const;

const uploadErrorTypeOf = (error: unknown): ClientUploadError["type"] => {
	switch (errorReasonOf(error)?.reason) {
		case undefined:
			return "unknown";
		case "UPLOAD_TOO_MANY_FILES":
			return "too_many_files";
		case "UPLOAD_FILE_TOO_LARGE":
			return "file_too_large";
		case "UPLOAD_FILE_TYPE_INVALID":
			return "invalid_file_type";
		default:
			return "invalid_request";
	}
};

const toClientUploadError = (error: unknown): ClientUploadError => {
	if (error instanceof ClientUploadErrorClass) {
		if (error.type === "no_files") {
			return createNoFilesError();
		}

		console.error(error);

		return {
			type: error.type,
			message: m.assets_upload_unknown_error(),
		};
	}

	return {
		type: uploadErrorTypeOf(error),
		message: describeError(error),
	};
};

const translateFileError = (
	file: FileUploadInfo<UploadStatus>,
): FileUploadInfo<UploadStatus> => {
	if (file.status !== "failed") {
		return file;
	}

	const { error } = file as FileUploadInfo<"failed">;

	return {
		...file,
		error: {
			...error,
			message:
				reasonMessageOf(error.cause) ??
				m.assets_upload_progress_file_error_label(),
		},
	} as FileUploadInfo<"failed">;
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

export function useUploadFiles({
	route = "asset",
	uploadBatchSize,
	multipartBatchSize,
	onError,
	onBeforeUpload,
	onUploadBegin,
	onUploadComplete,
	onUploadFail,
	onUploadProgress,
	onUploadSettle,
}: UploadHookProps<UploadRouteName, true>): UploadHookReturn<true> {
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
	// Unmounting mid-upload stops the transfers and aborts open multipart uploads.
	const abortController = useRef<AbortController | null>(null);
	useEffect(
		() => () => {
			abortController.current?.abort();
		},
		[],
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
			abortController.current?.abort();
			const controller = new AbortController();
			abortController.current = controller;

			const fileArray = Array.from(files);

			if (fileArray.length === 0) {
				const noFilesError = createNoFilesError();
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
							const noFilesError = createNoFilesError();
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
					signal: controller.signal,
					onUploadBegin,
					onMultipartComplete: (data) =>
						completeMultipartUpload({
							route: data.route,
							uploadId: data.uploadId,
							file: data.file,
							parts: data.parts,
						}),
					onMultipartAbort: (data) =>
						client.storage.abortMultipartUpload({
							route: data.route,
							uploadId: data.uploadId,
							file: data.file,
						}),
					onFileStateChange: ({ file: rawFile }) => {
						const file = translateFileError(rawFile);
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
			onError,
			onBeforeUpload,
			onUploadBegin,
			onUploadComplete,
			onUploadFail,
			onUploadProgress,
			onUploadSettle,
			completeMultipartUpload,
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
