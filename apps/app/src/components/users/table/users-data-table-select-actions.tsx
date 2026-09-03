import type { UserWithOrganizationRole } from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";

const UsersDataTableSelectActions = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { table } = useTable<UserWithOrganizationRole>();
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const deleteUsers = useDeleteUsersMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const selectedRows = table.getSelectedRowModel().rows;
	const hasProtectedSelection = selectedRows.some(
		(row) =>
			row.original.id === auth.user.id ||
			(row.original.organizationRole === "admin" && !canManageOrganization),
	);

	return (
		<DataTableBulkActions<UserWithOrganizationRole>
			isPending={deleteUsers.isPending}
			actions={
				hasProtectedSelection
					? []
					: [
							{
								label: "Delete selected",
								variant: "destructive",
								onSelect: ({ selectedRows }) =>
									deleteUsers.mutate({
										userIds: selectedRows.map((row) => row.original.id),
									}),
							},
						]
			}
		/>
	);
};

export { UsersDataTableSelectActions };
