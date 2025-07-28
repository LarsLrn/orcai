import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { type FileUploadSchemaType, fileUploadSchema } from "@/db/zod/file";
import { assetQueryOptions } from "@/lib/query-options/asset";
import { FileUploader } from "./file-uploader";
import { UploadProgress } from "./upload-progress";
import { useUploadFiles } from "./use-upload-files";

const UploadComponent = () => {
	const queryClient = useQueryClient();
	const [showProgress, setShowProgress] = useState(false);

	const { mutateAsync: createAsset } = useMutation(
		assetQueryOptions.create(queryClient),
	);

	const { upload, control } = useUploadFiles({
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

	const form = useForm<FileUploadSchemaType>({
		resolver: zodResolver(fileUploadSchema),
		defaultValues: {
			files: [],
		},
	});

	function onSubmit(input: FileUploadSchemaType) {
		toast.promise(upload(input.files), {
			loading: "Uploading files...",
			success: (data) => {
				form.reset();
				return {
					message: `Successfully uploaded ${data.files.length} files.`,
					description: data.failedFiles.length
						? `Failed to upload ${data.failedFiles.length} files.`
						: undefined,
				};
			},
			error: () => {
				// This should never happen, as "upload" does not throw.
				return "Error uploading files.";
			},
		});
	}

	if (showProgress) {
		return (
			<div className="space-y-6">
				{/* Upload Progress */}
				<UploadProgress
					control={control}
					onReset={() => {
						form.reset();
						setShowProgress(false);
					}}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex w-full flex-col gap-6"
				>
					<FormField
						control={form.control}
						name="files"
						render={({ field }) => (
							<div className="space-y-6">
								<FormItem className="w-full">
									<FormLabel>Files</FormLabel>
									<FormControl>
										<FileUploader
											value={field.value}
											onValueChange={field.onChange}
											maxFileCount={100}
											maxSize={32 * 1024 * 1024}
											multiple
											accept={{
												"image/*": [],
												"video/*": [],
												"audio/*": [],
												"application/pdf": [],
												"text/*": [],
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							</div>
						)}
					/>

					<Button className="w-fit">Save</Button>
				</form>
			</Form>
		</div>
	);
};

export { UploadComponent };
