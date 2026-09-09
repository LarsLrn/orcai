import type { Group } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteGroupsMutation } from "@/hooks/mutations/use-group-mutations";

const GroupTableActions = () => {
	const { table } = useTable();
	const deleteGroups = useDeleteGroupsMutation({
		onSuccess: () => table.resetRowSelection(),
	});

	return (
		<DataTableBulkActions<Group>
			isPending={deleteGroups.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteGroups.mutate({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						}),
				},
			]}
		/>
	);
};

export { GroupTableActions };
