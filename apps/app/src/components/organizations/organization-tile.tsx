import type { Organization } from "@orcai/schema";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import {
	Tile,
	TileBody,
	TileDescription,
	TileIcon,
	TileTitle,
} from "@/components/ui/shell/tile";

const OrganizationTile = ({
	organization,
	onSelect,
	loading,
	disabled,
}: {
	organization: Organization;
	onSelect: () => void;
	loading?: boolean;
	disabled?: boolean;
}) => (
	<Tile>
		<TileIcon className="bg-transparent">
			<OrganizationLogo organization={organization} size="lg" />
		</TileIcon>
		<TileBody>
			<TileTitle
				action={{
					onClick: onSelect,
					loading,
					disabled,
				}}
			>
				{organization.name}
			</TileTitle>
			{organization.slug ? (
				<TileDescription>@{organization.slug}</TileDescription>
			) : null}
		</TileBody>
	</Tile>
);

export { OrganizationTile };
