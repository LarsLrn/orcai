import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Document } from "@/db/schema/document";
import { orpc } from "@/lib/orpc/orpc";
import { getFileTypeFromMime, uploadToS3 } from "@/lib/s3/upload-helpers";

export interface UploadState {
	step: "idle" | "getting-urls" | "uploading" | "saving-metadata" | "completed";
	progress: number;
	currentFile?: string;
	fileProgress: Record<string, number>;
}

export const useFileUpload = (options?: { timeoutMs?: number }) => {
	const queryClient = useQueryClient();
	const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000; // Default 10 minutes
	const [uploadState, setUploadState] = useState<UploadState>({
		step: "idle",
		progress: 0,
		fileProgress: {},
	});

	// Store current upload XMLHttpRequests for cancellation
	const [currentUploads, setCurrentUploads] = useState<XMLHttpRequest[]>([]);

	// Get presigned URLs mutation using ORPC
	const { mutateAsync: getPresignedUrls } = useMutation(
		orpc.storage.createUploadUrls.mutationOptions({
			onError(error) {
				console.error("Failed to get presigned URLs:", error);
				alert(error.message);
			},
		}),
	);

	// Save document info mutation using ORPC
	const { mutateAsync: saveDocumentInfo } = useMutation(
		orpc.asset.create.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.asset.key(),
				});
			},
			onError(error) {
				console.error("Failed to save document info:", error);
			},
		}),
	);

	// Main upload mutation that orchestrates everything
	const uploadMutation = useMutation({
		mutationFn: async (files: File[]) => {
			setUploadState({ step: "getting-urls", progress: 10, fileProgress: {} });

			const filesInfo = files.map((file) => ({
				name: file.name,
				size: file.size,
				type: getFileTypeFromMime(file.type),
			}));

			// Step 1: Get presigned URLs
			const presignedUrls = await getPresignedUrls(filesInfo);
			setUploadState((prev) => ({
				...prev,
				step: "uploading",
				progress: 30,
			}));

			// Step 2: Upload files to S3 with progress tracking
			const uploadResults: Array<{
				presignedUrl: (typeof presignedUrls.data)[number];
				file: File;
			}> = [];
			const totalFiles = presignedUrls.data.length;

			for (let i = 0; i < presignedUrls.data.length; i++) {
				const presignedUrl = presignedUrls.data[i];
				const file = files.find(
					(f) => f.name === presignedUrl.name && f.size === presignedUrl.size,
				);

				if (!file) continue;

				setUploadState((prev) => ({
					...prev,
					currentFile: file.name,
				}));

				// Upload to S3 with progress tracking
				const { promise: uploadPromise, xhr } = uploadToS3(
					presignedUrl.url,
					file,
					(fileProgress: number) => {
						setUploadState((prev) => {
							const updatedFileProgress = {
								...prev.fileProgress,
								[file.name]: fileProgress,
							};

							// Calculate overall progress based on completed files + current file progress
							const completedFiles = i; // Files already completed
							const currentFileContribution = fileProgress / 100; // Current file progress as decimal
							const totalFileProgress =
								(completedFiles + currentFileContribution) / totalFiles;
							const overallProgress = 30 + totalFileProgress * 40; // Map to 30-70% range

							return {
								...prev,
								fileProgress: updatedFileProgress,
								progress: overallProgress,
							};
						});
					},
					timeoutMs, // Use configurable timeout
				);

				// Store the XMLHttpRequest for potential cancellation
				setCurrentUploads((prev) => [...prev, xhr]);

				const uploadResponse = await uploadPromise;

				if (uploadResponse.status !== 200) {
					throw new Error(`Failed to upload ${file.name}`);
				}

				uploadResults.push({ presignedUrl, file });
			}

			// Step 3: Save metadata
			setUploadState((prev) => ({
				...prev,
				step: "saving-metadata",
				progress: 80,
			}));

			const documents: Document[] = [];
			for (let i = 0; i < uploadResults.length; i++) {
				const { presignedUrl } = uploadResults[i];

				// Use ORPC mutation to save document info
				const document = await saveDocumentInfo({
					id: presignedUrl.id,
					title: presignedUrl.name,
					size: presignedUrl.size,
					fileType: presignedUrl.type,
				});

				documents.push(document);

				setUploadState((prev) => ({
					...prev,
					progress: 80 + ((i + 1) / uploadResults.length) * 20,
				}));
			}

			setUploadState((prev) => ({
				...prev,
				step: "completed",
				progress: 100,
			}));

			return documents;
		},
		onSuccess: () => {
			// Clear the uploads array on success
			setCurrentUploads([]);

			queryClient.invalidateQueries({
				queryKey: orpc.asset.key(),
			});
			setTimeout(() => {
				setUploadState({
					step: "idle",
					progress: 0,
					fileProgress: {},
				});
			}, 1000);
		},
		onError: (error) => {
			console.error("Upload failed:", error);

			// Clear the uploads array on error
			setCurrentUploads([]);

			setUploadState({
				step: "idle",
				progress: 0,
				fileProgress: {},
			});
			alert(error.message);
		},
	});

	const cancelUpload = () => {
		// Abort all ongoing uploads
		currentUploads.forEach((xhr) => {
			if (xhr.readyState !== XMLHttpRequest.DONE) {
				xhr.abort();
			}
		});

		// Clear the uploads array
		setCurrentUploads([]);

		// Reset upload state
		setUploadState({
			step: "idle",
			progress: 0,
			fileProgress: {},
		});

		// Cancel the mutation if it's running
		uploadMutation.reset();
	};

	return {
		upload: uploadMutation.mutateAsync,
		isUploading: uploadMutation.isPending,
		uploadState,
		error: uploadMutation.error,
		cancelUpload,
	};
};
