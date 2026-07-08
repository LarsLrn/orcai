import type { Model } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteModelsMutation } from "@/hooks/mutations/use-model-mutations";

const ModelTableActions = () => {
	const { table } = useTable();
	const deleteModels = useDeleteModelsMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	return (
		<DataTableBulkActions<Model>
			isPending={deleteModels.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteModels.mutate({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						}),
				},
			]}
		/>
	);
};

export { ModelTableActions };
