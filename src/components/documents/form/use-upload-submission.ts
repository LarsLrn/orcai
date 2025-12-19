import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useUploadFiles } from "@/components/documents/use-upload-files";
import { orpc } from "@/lib/orpc/orpc";

export const useUploadSubmission = () => {
	const [showProgress, setShowProgress] = useState(false);

	const { mutateAsync: createAsset } = useMutation(
		orpc.asset.create.mutationOptions(),
	);

	const { upload, control, reset } = useUploadFiles({
		onUploadComplete(data) {
			data.files.forEach((file) => {
				createAsset({
					id: file.objectKey,
					title: file.name,
					size: file.size,
					fileType: file.type,
				});
			});
		},
		onBeforeUpload() {
			setShowProgress(true);
		},
	});

	const submit = (
		value: { files: File[] },
		options?: { onSuccess?: () => void },
	) => {
		return toast.promise(upload(value.files), {
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
			error: () => {
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
