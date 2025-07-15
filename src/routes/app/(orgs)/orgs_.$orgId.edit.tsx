import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageOrganization } from "@/components/organizations/manage-organization";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(orgs)/orgs_/$orgId/edit")({
	loader: async ({ context: { queryClient }, params: { orgId } }) => {
		await queryClient.ensureQueryData(
			orpc.organization.find.queryOptions({
				input: { id: orgId },
				queryKey: orpc.organization.find.key({ input: { id: orgId } }),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { orgId } = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: { id: orgId },
			queryKey: orpc.organization.find.key({ input: { id: orgId } }),
		}),
	);

	return <ManageOrganization organization={organization.data} />;
}
