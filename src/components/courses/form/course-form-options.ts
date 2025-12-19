import { formOptions } from "@tanstack/form-core";
import { type Course, courseInsertSchema } from "@/lib/orpc/schemas/course";

const defaultValues = (course?: Course) => ({
	title: course?.title ?? "",
	description: course?.description ?? "",
	contentJson: course?.contentJson ?? ({} as any), // FIXME: Avoid using 'any'
	contentHtml: course?.contentHtml ?? "",
	config: {
		systemPrompt: course?.config?.systemPrompt ?? "",
		maxReferences: course?.config?.maxReferences ?? 5,
		model: course?.config?.model ?? "",
	},
});

export const courseFormOptions = (course?: Course) =>
	formOptions({
		defaultValues: defaultValues(course),
		validators: {
			onChange: courseInsertSchema,
		},
	});
