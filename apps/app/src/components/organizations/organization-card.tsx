import type { Organization } from "@orcai/schema";
import { BuildingIcon } from "lucide-react";
import {
	ResourceCard,
	ResourceCardBadges,
	ResourceCardBody,
	ResourceCardContent,
	ResourceCardDescription,
	ResourceCardHeader,
	ResourceCardTitle,
} from "@/components/ui/shell/resource-card";
import { m } from "@/paraglide/messages";

const OrganizationCard = ({
	organization,
	onSelect,
}: {
	organization: Organization;
	onSelect: () => void;
}) => {
	return (
		<ResourceCard>
			<ResourceCardBody
				action={{
					onClick: onSelect,
				}}
			>
				<ResourceCardHeader>
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
