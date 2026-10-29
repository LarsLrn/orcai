import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { OrganizationLogoSettings } from "@/components/images/image-settings";
import { OrganizationForm } from "@/components/organizations/form/organization-form";
import { Card, CardContent } from "@/components/ui/card";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/organization/")({
	loader: async ({ context: { queryClient, auth } }) => {
		await queryClient.query(
			orpc.organization.find.queryOptions({
				input: {
					id: auth.session.activeOrganizationId,
				},
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.orgs_settings_page_title()}</PageTitle>
				<PageDescription>{m.orgs_settings_page_description()}</PageDescription>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardContent className="flex flex-col gap-6">
						<OrganizationLogoSettings organization={organization.data} />
						<OrganizationForm
							key={organization.data.id}
							action="update"
							organization={organization.data}
						/>
					</CardContent>
				</Card>
				<div>
					<MetadataCard
						id={organization.data.id}
						createdAt={organization.data.createdAt}
					/>
				</div>
			</PageContent>
		</Page>
	);
}
