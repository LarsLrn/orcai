import { BuildingIcon } from "lucide-react";
import type { Organization } from "@/lib/orpc/schemas/organization";
import {
	ResourceCard,
	ResourceCardBadges,
	ResourceCardBody,
	ResourceCardContent,
	ResourceCardDescription,
	ResourceCardHeader,
	ResourceCardTitle,
} from "../ui/shell/resource-card";

const OrganizationCard = ({
	organization,
	onSelect,
}: {
	organization: Organization;
	onSelect: () => void;
}) => {
	return (
		<ResourceCard>
			<ResourceCardBody action={{ onClick: onSelect }}>
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
								label: "Organization",
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
