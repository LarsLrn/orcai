import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/form/course-form";

export const Route = createFileRoute("/app/courses/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	return <CourseForm action="create" />;
}
