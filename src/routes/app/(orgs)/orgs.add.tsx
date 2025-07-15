import { createFileRoute } from "@tanstack/react-router";
import { OrganizationForm } from "@/components/organizations/organization-form";

export const Route = createFileRoute("/app/(orgs)/orgs/add")({
	component: RouteComponent,
});

function RouteComponent() {
	return <OrganizationForm />;
}
