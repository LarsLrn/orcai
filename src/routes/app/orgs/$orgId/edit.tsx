import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageOrganization } from "@/components/organizations/manage-organization";
import { organizationQueryOptions } from "@/lib/query-options/organization";

export const Route = createFileRoute("/app/orgs/$orgId/edit")({
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
	const { orgId } = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		organizationQueryOptions.find({
			input: { id: orgId },
		}),
	);

	return <ManageOrganization organization={organization.data} />;
}
