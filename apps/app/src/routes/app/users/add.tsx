import { createFileRoute } from "@tanstack/react-router";
import { OrganizationInvitationForm } from "@/components/organizations/invitation-form/organization-invitation-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/users/add")({
	loader: async ({ context: { queryClient, auth } }) => {
		await queryClient.query(
			orpc.organization.find.queryOptions({
				input: {
					id: auth.session.activeOrganizationId,
				},
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.users_add_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.users_add_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<OrganizationInvitationForm />
			</PageContent>
		</Page>
	);
}
