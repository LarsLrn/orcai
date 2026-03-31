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

export const Route = createFileRoute("/app/users/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Add User</PageTitle>
			</PageHeader>
			<PageContent>
				<Suspense fallback={<LoadingPage />}>
					<OrganizationInvitationForm />
				</Suspense>
			</PageContent>
		</Page>
	);
}
