import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/course-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/courses/$courseId/edit")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
			queryKey: orpc.course.find.key({ input: { id: courseId } }),
		}),
	);

	return <CourseForm course={course.data} />;
}
