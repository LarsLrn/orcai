import type { ResourceOwner as Owner, SourceOrganization } from "@orcai/schema";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { ResourceOwner } from "@/components/users/resource-owner";
import { m } from "@/paraglide/messages";

/** The organisation a resource comes from, with its logo. */
const SourceOrganizationName = ({
	organization,
	label = organization.name,
}: {
	organization: SourceOrganization;
	/** What names it; its name unless given. */
	label?: string;
}) => (
	<span
		data-slot="source-organization"
		className="flex min-w-0 items-center gap-1.5"
	>
		<OrganizationLogo organization={organization} size="sm" />
		<span className="truncate">{label}</span>
	</span>
);

/** Who a resource comes from: its owner, or "From <org>" when the organisation added it from the catalogue. */
const ResourceProvenance = ({
	owner,
	installedFrom,
}: {
	owner: Owner;
	installedFrom: SourceOrganization | null;
}) =>
	installedFrom ? (
		<SourceOrganizationName
			organization={installedFrom}
			label={m.catalogue_from_organisation({
				organisation: installedFrom.name,
			})}
		/>
	) : (
		<ResourceOwner owner={owner} />
	);

export { ResourceProvenance, SourceOrganizationName };
