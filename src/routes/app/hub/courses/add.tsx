import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { CourseForm } from "@/components/courses/form/course-form";

export const Route = createFileRoute("/app/hub/courses/add")({
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
	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Course</PageTitle>
			</PageHeader>
			<PageContent>
				<CourseForm action="create" />
			</PageContent>
		</Page>
	);
}
