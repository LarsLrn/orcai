import type { HomeOrganization, ResourceOwner as Owner } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { ResourceOwner } from "@/components/users/resource-owner";
import { m } from "@/paraglide/messages";

/** The organisation a resource comes from, with its logo, linking to its page above a tile's own link. */
const HomeOrganizationName = ({
	organization,
	label = organization.name,
}: {
	organization: HomeOrganization;
	/** What names it; its name unless given. */
	label?: string;
}) => (
	<Link
		to="/app/organizations/$organizationId"
		params={{
			organizationId: organization.id,
		}}
		data-slot="source-organization"
		className="relative z-10 flex min-w-0 items-center gap-1.5 rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/75"
	>
		<OrganizationLogo organization={organization} size="sm" />
		<span className="truncate">{label}</span>
	</Link>
);

/** Who a resource comes from: its owner, or "From <org>" when the organisation added it from the catalogue. */
const ResourceProvenance = ({
	owner,
	homeOrganization,
}: {
	owner: Owner;
	homeOrganization: HomeOrganization | null;
}) =>
	homeOrganization ? (
		<HomeOrganizationName
			organization={homeOrganization}
			label={m.catalogue_from_organisation({
				organisation: homeOrganization.name,
			})}
		/>
	) : (
		<ResourceOwner owner={owner} />
	);

export { HomeOrganizationName, ResourceProvenance };
