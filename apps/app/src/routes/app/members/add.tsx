import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { OrganizationInvitationForm } from "@/components/organizations/invitation-form/organization-invitation-form";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/members/add")({
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
				title: m.members_add_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<FormPage title={m.members_add_page_title()}>
			<OrganizationInvitationForm />
		</FormPage>
	);
}
