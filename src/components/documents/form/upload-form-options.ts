import { formOptions } from "@tanstack/react-form";
import { fileUploadSchema } from "@/db/zod/file";

const defaultValues = () => ({
	files: [] as File[],
});

export const uploadFormOptions = () =>
	formOptions({
		defaultValues: defaultValues(),
		validators: {
			onChange: fileUploadSchema,
		},
	});
