import { createFileRoute } from "@tanstack/react-router";
import { OrganizationProviderForm } from "@/components/organizations/providers/organization-provider-form";

export const Route = createFileRoute("/app/orgs/$orgId/providers/add")({
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
	const { orgId } = Route.useParams();

	return <OrganizationProviderForm organizationId={orgId} />;
}
