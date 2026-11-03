import type { UserWithOrganizationRole } from "@orcai/schema";
import { useState } from "react";
import { RemoveMembersDialog } from "@/components/members/remove-members-dialog";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useMembershipControl } from "@/hooks/authz/use-membership-control";
import { m } from "@/paraglide/messages";

const MembersDataTableSelectActions = () => {
	const { table } = useTable<UserWithOrganizationRole>();
	const { canManageMember } = useMembershipControl();
	const [removing, setRemoving] = useState<UserWithOrganizationRole[]>([]);
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);
	const selectedRows = table.getSelectedRowModel().rows;
	const hasProtectedSelection = selectedRows.some(
		(row) => !canManageMember(row.original),
	);

	return (
		<>
			<DataTableBulkActions<UserWithOrganizationRole>
				actions={
					hasProtectedSelection
						? []
						: [
								{
									label: m.members_table_bulk_remove_action(),
									variant: "destructive",
									onSelect: ({ selectedRows }) => {
										setRemoving(selectedRows.map((row) => row.original));
										setIsRemoveOpen(true);
									},
								},
							]
				}
			/>
			<RemoveMembersDialog
				members={removing}
				open={isRemoveOpen}
				onOpenChange={setIsRemoveOpen}
				onRemoved={() => table.resetRowSelection()}
			/>
		</>
	);
};

export { MembersDataTableSelectActions };
