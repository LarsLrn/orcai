import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationForm } from "@/components/organizations/form/organization-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/orgs/$orgId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.orgs_edit_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { orgId } = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: orgId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.orgs_edit_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<OrganizationForm action="update" organization={organization.data} />
			</PageContent>
		</Page>
	);
}
