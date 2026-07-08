import type { Organization } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteOrganizationsMutation } from "@/hooks/mutations/use-organization-mutations";

const OrganizationTableActions = () => {
	const { table } = useTable();
	const deleteOrganizations = useDeleteOrganizationsMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	return (
		<DataTableBulkActions<Organization>
			isPending={deleteOrganizations.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteOrganizations.mutate({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						}),
				},
			]}
		/>
	);
};

export { OrganizationTableActions };
