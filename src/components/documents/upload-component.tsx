import { useAppForm } from "@/hooks/form";
import { useUploadSubmission } from "@/hooks/mutations/use-upload-submission";
import { uploadFormOptions } from "./form/upload-form-options";
import { UploadProgress } from "./upload-progress";

const UploadComponent = () => {
	const { submit, control, showProgress, resetProgress } =
		useUploadSubmission();

	const form = useAppForm({
		...uploadFormOptions(),
		onSubmit: ({ value }) => {
			submit(value, {
				onSuccess: () => form.reset(),
			});
		},
	});

	if (showProgress) {
		return (
			<div className="space-y-6">
				<UploadProgress
					control={control}
					onReset={() => {
						form.reset();
						resetProgress();
					}}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="flex w-full flex-col gap-6"
				noValidate
			>
				<form.AppField
					name="files"
					children={(field) => (
						<field.UploadField
							label="Files"
							maxFileCount={100}
							maxSize={64 * 1024 * 1024}
							multiple
							accept={{
								"image/*": [],
								"video/*": [],
								"audio/*": [],
								"application/pdf": [],
								"text/*": [],
							}}
						/>
					)}
				/>

				<form.AppForm>
					<form.SubmitButton label="Save Files" />
				</form.AppForm>
			</form>
		</div>
	);
};

export { UploadComponent };
