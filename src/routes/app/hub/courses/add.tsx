import { createFileRoute } from "@tanstack/react-router";
import { CourseForm } from "@/components/courses/form/course-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

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
