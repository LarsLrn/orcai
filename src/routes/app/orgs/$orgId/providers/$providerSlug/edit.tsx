import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageOrganizationProvider } from "@/components/organizations/providers/manage-organization-provider";
import { orpc } from "@/lib/orpc/orpc";

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
	const { providerSlug } = Route.useParams();
	const { data: organizationProvider } = useSuspenseQuery(
		orpc.organizationProvider.find.queryOptions({
			input: { providerSlug },
		}),
	);

	return (
		<ManageOrganizationProvider
			organizationProvider={organizationProvider.data}
		/>
	);
}
