import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { OrganizationInvitationForm } from "@/components/organizations/invitation-form/organization-invitation-form";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/members/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.members_add_page_title(),
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
