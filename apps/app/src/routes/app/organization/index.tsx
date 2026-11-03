import { createFileRoute } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { FormPage } from "@/components/forms/form-layout";
import { OrganizationForm } from "@/components/organizations/form/organization-form";
import { useSuspenseActiveOrganization } from "@/hooks/use-active-organization";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/organization/")({
	component: RouteComponent,
});

function RouteComponent() {
	const organization = useSuspenseActiveOrganization();

	return (
		<FormPage
			title={m.orgs_settings_page_title()}
			description={m.orgs_settings_page_description()}
		>
			<div className="flex flex-col gap-5">
				<OrganizationForm
					key={organization.id}
					action="update"
					organization={organization}
				/>
				<MetadataCard id={organization.id} createdAt={organization.createdAt} />
			</div>
		</FormPage>
	);
}
