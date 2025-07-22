import { createFileRoute } from "@tanstack/react-router";
import { OrganizationProviderForm } from "@/components/organizations/providers/organization-provider-form";

export const Route = createFileRoute("/app/(orgs)/orgs/$orgId_/providers/add")({
	component: RouteComponent,
});

function RouteComponent() {
	const { orgId } = Route.useParams();

	return <OrganizationProviderForm organizationId={orgId} />;
}
