import type { UserWithOrganizationRole } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";

const UsersDataTableSelectActions = () => {
	const { table } = useTable();
	const deleteUsers = useDeleteUsersMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	return (
		<DataTableBulkActions<UserWithOrganizationRole>
			isPending={deleteUsers.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteUsers.mutate({
							userIds: selectedRows.map((row) => row.original.id),
						}),
				},
			]}
		/>
	);
};

export { UsersDataTableSelectActions };
