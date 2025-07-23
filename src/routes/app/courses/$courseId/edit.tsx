import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/course-form";
import { courseQueryOptions } from "@/lib/query-options/course";

export const Route = createFileRoute("/app/courses/$courseId/edit")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		courseQueryOptions.find({
			input: { id: courseId },
		}),
	);

	return <CourseForm course={course.data} />;
}
