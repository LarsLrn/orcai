import { ASSET_UPLOAD_ACCEPT, type DirectUploadResult } from "@orcai/s3/client";
import type { FinalizedUploadFile, StorageUploadRoute } from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { DropzoneProps } from "react-dropzone";
import { toast } from "sonner";
import { FileUploader } from "@/components/documents/file-uploader";
import { UploadProgress } from "@/components/documents/upload-progress";
import { useUploadFiles } from "@/components/documents/use-upload-files";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

type UploadResult = DirectUploadResult<true>;

type UploadComponentProps = {
	route: StorageUploadRoute;
	title?: string;
	description?: string;
	uploadLabel?: string;
	accept?: DropzoneProps["accept"];
	maxSize?: number;
	maxFileCount?: number;
	multiple?: boolean;
	disabled?: boolean;
	finalizeUpload?: boolean;
	hidePickerWhenSettled?: boolean;
	completionAction?: {
		label: string;
		onClick: () => void;
		disabled?: boolean;
	};
	onReset?: () => void;
	onUploaded?: (result: {
		uploadResult: UploadResult;
		finalizedFiles: FinalizedUploadFile[];
	}) => void | Promise<void>;
};

const toFinalizeInputFiles = (result: UploadResult) =>
	result.files.map((file) => ({
		objectKey: file.objectKey,
		objectMetadata: file.objectMetadata,
		name: file.name,
		size: file.size,
		type: file.type,
	}));

const UploadComponent = ({
	route,
	title = "Upload Files",
	description = "Select files, upload them, and review progress inline.",
	uploadLabel = "Upload Files",
	accept = {
		...ASSET_UPLOAD_ACCEPT,
	},
	maxSize = 64 * 1024 * 1024,
	maxFileCount = 100,
	multiple = true,
	disabled = false,
	finalizeUpload: shouldFinalizeUpload = false,
	hidePickerWhenSettled = false,
	completionAction,
	onReset,
	onUploaded,
}: UploadComponentProps) => {
	const [files, setFiles] = useState<File[]>([]);
	const [isFinalizing, setIsFinalizing] = useState(false);
	const { uploadAsync, control, reset } = useUploadFiles({
		route,
	});
	const { mutateAsync: finalizeUpload } = useMutation(
		orpc.storage.finalizeUpload.mutationOptions(),
	);

	const progresses = useMemo(
		() =>
			Object.fromEntries(
				control.progresses.map((file) => [
					file.name,
					Math.round(file.progress * 100),
				]),
			),
		[
			control.progresses,
		],
	);

	const handleUpload = async () => {
		if (files.length === 0) {
			return;
		}

		const target = files.length === 1 ? "1 file" : `${files.length} files`;

		await toast.promise(
			(async () => {
				const uploadResult = await uploadAsync(files);
				setIsFinalizing(true);

				try {
					const finalizedFiles =
						shouldFinalizeUpload && uploadResult.files.length > 0
							? (
									await finalizeUpload({
										route,
										files: toFinalizeInputFiles(uploadResult),
									})
								).data
							: [];

					await onUploaded?.({
						uploadResult,
						finalizedFiles,
					});

					return uploadResult;
				} finally {
					setIsFinalizing(false);
				}
			})(),
			{
				loading: `Uploading ${target}...`,
				success: () => `${target} uploaded`,
				error: `Failed to upload ${target}`,
			},
		);
	};

	return (
		<div className="space-y-6">
			{!(hidePickerWhenSettled && control.isSettled) ? (
				<Card>
					<CardHeader>
						<CardTitle>{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</CardHeader>
					<CardContent>
						<FileUploader
							value={files}
							onValueChange={setFiles}
							progresses={progresses}
							maxFileCount={maxFileCount}
							maxSize={maxSize}
							multiple={multiple}
							accept={accept}
							disabled={disabled || control.isPending || isFinalizing}
						/>
						<div className="mt-4 flex justify-end">
							<Button
								type="button"
								onClick={() => {
									void handleUpload();
								}}
								disabled={
									files.length === 0 ||
									disabled ||
									control.isPending ||
									isFinalizing
								}
							>
								{isFinalizing ? "Preparing Files..." : uploadLabel}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			{control.isPending || control.isSettled ? (
				<UploadProgress
					control={control}
					onReset={() => {
						setFiles([]);
						reset();
						onReset?.();
					}}
				/>
			) : null}

			{control.isSettled && completionAction ? (
				<div className="flex justify-end">
					<Button
						type="button"
						onClick={completionAction.onClick}
						disabled={completionAction.disabled}
					>
						{completionAction.label}
					</Button>
				</div>
			) : null}
		</div>
	);
};

export { UploadComponent, type UploadComponentProps, type UploadResult };
