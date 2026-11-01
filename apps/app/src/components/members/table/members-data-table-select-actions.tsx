import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import type { UserWithOrganizationRole } from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { RemoveMembersDialog } from "@/components/members/remove-members-dialog";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { m } from "@/paraglide/messages";

const MembersDataTableSelectActions = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { table } = useTable<UserWithOrganizationRole>();
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const [removing, setRemoving] = useState<UserWithOrganizationRole[]>([]);
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const selectedRows = table.getSelectedRowModel().rows;
	const hasProtectedSelection = selectedRows.some(
		(row) =>
			row.original.id === auth.user.id ||
			(row.original.organizationRole === ORGANIZATION_ADMIN_ROLE &&
				!canManageOrganization),
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
