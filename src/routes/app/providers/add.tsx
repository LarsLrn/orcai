import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { ProviderForm } from "@/components/provider/form/provider-form";

export const Route = createFileRoute("/app/providers/add")({
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
				<PageTitle>Add Provider</PageTitle>
			</PageHeader>
			<PageContent>
				<ProviderForm action="create" />
			</PageContent>
		</Page>
	);
}
