import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { FormPage } from "@/components/forms/form-layout";
import { OrganizationForm } from "@/components/organizations/form/organization-form";
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
		<FormPage
			title={m.orgs_settings_page_title()}
			description={m.orgs_settings_page_description()}
		>
			<div className="flex flex-col gap-5">
				<OrganizationForm
					key={organization.data.id}
					action="update"
					organization={organization.data}
				/>
				<MetadataCard
					id={organization.data.id}
					createdAt={organization.data.createdAt}
				/>
			</div>
		</FormPage>
	);
}
