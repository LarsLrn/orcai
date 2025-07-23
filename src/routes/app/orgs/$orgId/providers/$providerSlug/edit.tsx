import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageOrganizationProvider } from "@/components/organizations/providers/manage-organization-provider";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";

export const Route = createFileRoute(
	"/app/orgs/$orgId/providers/$providerSlug/edit",
)({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
			},
		],
	}),
});

function RouteComponent() {
	const { orgId, providerSlug } = Route.useParams();
	const { data: organizationProvider } = useSuspenseQuery(
		organizationProviderQueryOptions.find({
			input: { organizationId: orgId, providerSlug },
		}),
	);

	return (
		<ManageOrganizationProvider
			organizationId={orgId}
			organizationProvider={organizationProvider.data}
		/>
	);
}
