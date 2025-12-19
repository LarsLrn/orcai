import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/form/course-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/courses/$courseId/edit")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
		}),
	);

	return <CourseForm action="update" course={course.data} />;
}
