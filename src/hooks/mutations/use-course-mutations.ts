import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useCourseMutations = () => {
	const router = useRouter();

	const createCourse = useMutationAction({
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

	const updateCourse = useMutationAction({
		mutationOptions: () => orpc.course.update.mutationOptions(),
		messages: {
			loading: "Updating course...",
			success: "Course updated successfully",
			error: "Failed to update course",
		},
		onSuccess: () => router.history.back(),
	});

	return { createCourse, updateCourse };
};
