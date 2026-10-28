import type { Organization } from "@orcai/schema";
import { BuildingIcon } from "lucide-react";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import {
	ResourceCard,
	ResourceCardBadges,
	ResourceCardBody,
	ResourceCardContent,
	ResourceCardDescription,
	ResourceCardHeader,
	ResourceCardMedia,
	ResourceCardTitle,
} from "@/components/ui/shell/resource-card";
import { m } from "@/paraglide/messages";

const OrganizationCard = ({
	organization,
	onSelect,
	loading,
	disabled,
}: {
	organization: Organization;
	onSelect: () => void;
	loading?: boolean;
	disabled?: boolean;
}) => {
	return (
		<ResourceCard>
			<ResourceCardBody
				action={{
					onClick: onSelect,
					loading,
					disabled,
				}}
			>
				<ResourceCardHeader>
					<ResourceCardMedia>
						<OrganizationLogo organization={organization} size="lg" />
					</ResourceCardMedia>
					<ResourceCardTitle>{organization.name}</ResourceCardTitle>
					{organization.slug ? (
						<ResourceCardDescription>
							@{organization.slug}
						</ResourceCardDescription>
					) : null}
				</ResourceCardHeader>

				<ResourceCardContent>
					<ResourceCardBadges
						badges={[
							{
								label: m.orgs_card_type_badge(),
								variant: "secondary",
								icon: BuildingIcon,
							},
						]}
					/>
				</ResourceCardContent>
			</ResourceCardBody>
		</ResourceCard>
	);
};

export { OrganizationCard };
