import { createFileRoute } from "@tanstack/react-router";
import { ProviderForm } from "@/components/provider/form/provider-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

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
