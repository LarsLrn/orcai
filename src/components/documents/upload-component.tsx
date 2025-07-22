import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
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
import { getErrorMessage } from "@/lib/handle-error";
import { FileUploader } from "./file-uploader";
import { UploadProgress } from "./upload-progress";
import { useFileUpload } from "./use-file-upload";

const UploadComponent = () => {
	const navigate = useNavigate();
	const { upload, isUploading, uploadState, cancelUpload } = useFileUpload();

	const form = useForm<FileUploadSchemaType>({
		resolver: zodResolver(fileUploadSchema),
		defaultValues: {
			files: [],
		},
	});

	function onSubmit(input: FileUploadSchemaType) {
		toast.promise(upload(input.files), {
			loading: "Uploading files...",
			success: async () => {
				form.reset();
				await navigate({ to: "/app/assets", replace: true });
				return "Files uploaded";
			},
			error: (err) => {
				return getErrorMessage(err);
			},
		});
	}

	return (
		<div className="space-y-6">
			{/* Upload Progress */}
			<UploadProgress
				uploadState={uploadState}
				isUploading={isUploading}
				onCancel={cancelUpload}
			/>

			{/* Hide form while uploading */}
			{!isUploading && (
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
												disabled={isUploading}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								</div>
							)}
						/>

						<Button className="w-fit" disabled={isUploading}>
							Save
						</Button>
					</form>
				</Form>
			)}
		</div>
	);
};

export { UploadComponent };
