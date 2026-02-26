import { useAppForm } from "@/hooks/form";
import { useCourseMutations } from "@/hooks/mutations/use-course-mutations";
import type { Course } from "@/lib/orpc/schemas/course";
import { courseFormOptions } from "./course-form-options";
import { CourseFormAiSettings } from "./sections/course-form-ai-settings";
import { CourseFormInfo } from "./sections/course-form-info";

const CourseForm = ({
	action,
	course,
}: {
	action: "create" | "update";
	course?: Course;
}) => {
	const { createCourse, updateCourse } = useCourseMutations();

	const form = useAppForm({
		...courseFormOptions(course),
		onSubmit: ({ value }) => {
			if (action === "update" && course) {
				updateCourse.run({ ...value, id: course.id });
			} else {
				createCourse.run(value);
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<CourseFormInfo
					form={form}
					title="About the Course"
					className="lg:col-span-2"
				/>

				<CourseFormAiSettings form={form} title="Course AI Settings" />
			</div>
			<form.AppForm>
				<form.SubmitButton label="Save course" />
			</form.AppForm>
		</form>
	);
};

export { CourseForm };
