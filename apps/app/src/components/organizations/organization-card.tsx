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
