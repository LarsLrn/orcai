import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageOrganization } from "@/components/organizations/manage-organization";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

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
		orpc.organization.find.queryOptions({
			input: { id: orgId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit Organization</PageTitle>
			</PageHeader>
			<PageContent>
				<ManageOrganization organization={organization.data} />
			</PageContent>
		</Page>
	);
}
