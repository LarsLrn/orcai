import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { OrganizationInvitationForm } from "@/components/organizations/invitation-form/organization-invitation-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/users/add")({
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
				<Suspense fallback={<LoadingPage />}>
					<OrganizationInvitationForm />
				</Suspense>
			</PageContent>
		</Page>
	);
}
