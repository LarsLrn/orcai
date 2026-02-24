import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { OrganizationForm } from "@/components/organizations/form/organization-form";

export const Route = createFileRoute("/app/orgs/add")({
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
				<PageTitle>Add Organisation</PageTitle>
			</PageHeader>
			<PageContent>
				<OrganizationForm action="create" />
			</PageContent>
		</Page>
	);
}
