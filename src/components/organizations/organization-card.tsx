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
import type { Organization } from "@/lib/orpc/schemas/organization";

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
								label: "Organisation",
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
