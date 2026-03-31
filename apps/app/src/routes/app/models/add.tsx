import { createFileRoute } from "@tanstack/react-router";
import { ModelForm } from "@/components/model/form/model-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

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
