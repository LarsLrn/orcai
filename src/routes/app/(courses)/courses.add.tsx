import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/course-form";

export const Route = createFileRoute("/app/(courses)/courses/add")({
	component: RouteComponent,
});

function RouteComponent() {
	return <CourseForm />;
}
