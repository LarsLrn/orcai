import type { Provider } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteProvidersMutation } from "@/hooks/mutations/use-provider-mutations";

const ProviderTableActions = () => {
	const { table } = useTable();
	const deleteProviders = useDeleteProvidersMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	return (
		<DataTableBulkActions<Provider>
			isPending={deleteProviders.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteProviders.mutate({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						}),
				},
			]}
		/>
	);
};

export { ProviderTableActions };
