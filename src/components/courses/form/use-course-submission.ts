import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useCourseFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
		mutationOptions: () => orpc.course.create.mutationOptions(),
		messages: {
			loading: "Creating course...",
			success: "Course created successfully",
			error: "Failed to create course",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/courses/$courseId",
				params: { courseId: result.data.id },
			}),
	});

	const update = useFormSubmission({
		mutationOptions: () => orpc.course.update.mutationOptions(),
		messages: {
			loading: "Updating course...",
			success: "Course updated successfully",
			error: "Failed to update course",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
