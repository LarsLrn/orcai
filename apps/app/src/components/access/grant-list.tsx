import type { ResourceGrant, ResourceGrantRole } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GrantEditorRow } from "./grant-editor-row";

type GrantListProps = {
	grants: ResourceGrant[];
	search: string;
	onSearchChange: (value: string) => void;
	disabled?: boolean;
	onChangeRole: (grant: ResourceGrant, role: ResourceGrantRole) => void;
	onRevoke: (grant: ResourceGrant) => void;
};

const GrantList = ({
	grants,
	search,
	onSearchChange,
	disabled,
	onChangeRole,
	onRevoke,
}: GrantListProps) => {
	const filteredGrants = grants.filter((grant) => {
		const value = search.trim().toLowerCase();
		if (!value) return true;

		const details =
			grant.principal.type === "user"
				? grant.principal.email
				: (grant.principal.description ?? "");

		return (
			grant.principal.name.toLowerCase().includes(value) ||
			details.toLowerCase().includes(value)
		);
	});

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<UsersIcon className="h-4 w-4 text-muted-foreground" />
				<p className="font-medium text-sm">Direct grants</p>
			</div>
			<Input
				placeholder="Filter direct grants..."
				value={search}
				onChange={(event) => onSearchChange(event.target.value)}
				disabled={disabled}
			/>
			<div className="max-h-64 space-y-2 overflow-auto">
				{filteredGrants.map((grant) => (
					<GrantEditorRow
						key={`${grant.principalType}:${grant.principalId}:${grant.source}`}
						grant={grant}
						disabled={disabled}
						onChangeRole={(role) => onChangeRole(grant, role)}
						onRevoke={() => onRevoke(grant)}
					/>
				))}
				{filteredGrants.length === 0 && (
					<div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
						No direct grants found.
					</div>
				)}
			</div>
		</div>
	);
};

export { GrantList };
