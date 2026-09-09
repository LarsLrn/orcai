import type { ResourceGrant, ResourceGrantRole } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { FilterableList } from "@/components/ui/composed/filterable-list";
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
			title="Direct grants"
			icon={UsersIcon}
			search={search}
			onSearchChange={onSearchChange}
			placeholder="Filter by name or email"
			isEmpty={filteredGrants.length === 0}
			emptyText="No direct grants found."
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
