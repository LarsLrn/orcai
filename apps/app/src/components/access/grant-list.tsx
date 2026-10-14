import type { ResourceGrant, ResourceGrantRole } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { FilterableList } from "@/components/ui/composed/filterable-list";
import { m } from "@/paraglide/messages";
import { GrantEditorRow } from "./grant-editor-row";

type GrantListProps = {
	grants: ResourceGrant[];
	search: string;
	onSearchChange: (value: string) => void;
	disabled?: boolean;
	onChangeRole: (grant: ResourceGrant, role: ResourceGrantRole) => void;
	onRevoke: (grant: ResourceGrant) => void;
};

const matchesSearch = (grant: ResourceGrant, search: string) => {
	const value = search.trim().toLowerCase();
	if (!value) return true;

	const details =
		grant.principal.type === "user"
			? grant.principal.email
			: (grant.principal.description ?? "");

	return (
		grant.principal.name.toLowerCase().includes(value) ||
		(details ?? "").toLowerCase().includes(value)
	);
};

const GrantList = ({
	grants,
	search,
	onSearchChange,
	disabled,
	onChangeRole,
	onRevoke,
}: GrantListProps) => {
	const filteredGrants = grants.filter((grant) => matchesSearch(grant, search));

	return (
		<FilterableList
			title={m.access_grant_list_title()}
			icon={UsersIcon}
			search={search}
			onSearchChange={onSearchChange}
			placeholder={m.access_grant_list_filter_placeholder()}
			isEmpty={filteredGrants.length === 0}
			emptyText={m.access_grant_list_empty_state_description()}
			disabled={disabled}
		>
			{filteredGrants.map((grant) => (
				<GrantEditorRow
					key={`${grant.principalType}:${grant.principalId}:${grant.source}`}
					grant={grant}
					disabled={disabled}
					onChangeRole={(role) => onChangeRole(grant, role)}
					onRevoke={() => onRevoke(grant)}
				/>
			))}
		</FilterableList>
	);
};

export { GrantList };
