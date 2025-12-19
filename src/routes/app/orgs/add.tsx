import { createFileRoute } from "@tanstack/react-router";
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
	return <OrganizationForm action="create" />;
}
