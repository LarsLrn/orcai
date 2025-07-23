import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/course-form";

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
	return <CourseForm />;
}
