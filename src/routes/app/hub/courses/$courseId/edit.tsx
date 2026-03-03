import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { CourseForm } from "@/components/courses/form/course-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/courses/$courseId/edit")({
	component: RouteComponent,
});

function RouteComponent() {
	const { courseId } = Route.useParams();
	const { data: course } = useSuspenseQuery(
		orpc.course.find.queryOptions({
			input: { id: courseId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit Course</PageTitle>
			</PageHeader>
			<PageContent>
				<CourseForm action="update" course={course.data} />
			</PageContent>
		</Page>
	);
}
