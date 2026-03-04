import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useUploadFiles } from "@/components/documents/use-upload-files";
import { orpc } from "@/lib/orpc/orpc";
import { ClientUploadErrorClass } from "@/lib/s3/types/error";

export const useUploadSubmission = () => {
	const [showProgress, setShowProgress] = useState(false);

	const { mutateAsync: finalizeUpload } = useMutation(
		orpc.storage.finalizeUpload.mutationOptions(),
	);

	const { uploadAsync, control, reset } = useUploadFiles({
		route: "asset",
		async onUploadComplete(data) {
			if (data.files.length === 0) {
				return;
			}

			await finalizeUpload({
				route: "asset",
				files: data.files.map((file) => ({
					objectKey: file.objectKey,
					objectMetadata: file.objectMetadata,
					name: file.name,
					size: file.size,
					type: file.type,
				})),
			});
		},
		onBeforeUpload() {
			setShowProgress(true);
		},
	});

	const submit = (
		value: {
			files: File[];
		},
		options?: {
			onSuccess?: () => void;
		},
	) => {
		const uploadPromise = uploadAsync(value.files).then((result) => {
			if (result.files.length === 0 && result.failedFiles.length > 0) {
				throw new ClientUploadErrorClass({
					type: "s3_upload",
					message: "All files failed to upload.",
				});
			}

			return result;
		});

		return toast.promise(uploadPromise, {
			loading: "Uploading files...",
			success: (data) => {
				options?.onSuccess?.();
				return {
					message: `Successfully uploaded ${data.files.length} files.`,
					description: data.failedFiles.length
						? `Failed to upload ${data.failedFiles.length} files.`
						: undefined,
				};
			},
			error: (error) => {
				if (error instanceof Error) {
					return error.message;
				}

				return "Error uploading files.";
			},
		});
	};

	const resetProgress = () => {
		setShowProgress(false);
		reset();
	};

	return {
		submit,
		control,
		showProgress,
		resetProgress,
	};
};
