import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { ModelForm } from "@/components/model/form/model-form";

export const Route = createFileRoute("/app/models/add")({
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
				<PageTitle>Add Model</PageTitle>
			</PageHeader>
			<PageContent>
				<ModelForm action="create" />
			</PageContent>
		</Page>
	);
}
