import type { Organization } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import {
	Tile,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileTitle,
} from "@/components/ui/shell/tile";
import { m } from "@/paraglide/messages";

const OrganizationTile = ({
	organization,
	onSelect,
	loading,
	disabled,
	withPageLink,
}: {
	organization: Organization;
	onSelect: () => void;
	loading?: boolean;
	disabled?: boolean;
	/** Adds a link to the organisation's page, which needs an active organisation. */
	withPageLink?: boolean;
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
			{withPageLink ? (
				<TileFooter>
					<Link
						to="/app/organizations/$organizationId"
						params={{
							organizationId: organization.id,
						}}
						aria-label={m.select_organisation_page_profile_link_label({
							organisation: organization.name,
						})}
						className="relative z-10 rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/75"
					>
						{m.select_organisation_page_profile_link()}
					</Link>
				</TileFooter>
			) : null}
		</TileBody>
	</Tile>
);

export { OrganizationTile };
