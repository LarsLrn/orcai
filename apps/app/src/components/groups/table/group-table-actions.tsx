import type { Group } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

const GroupTableActions = () => {
	const { table } = useTable();
	const queryClient = useQueryClient();
	const deleteGroups = useMutationAction({
		mutationOptions: () =>
			orpc.group.delete.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});
					table.resetRowSelection();
				},
			}),
		messages: {
			loading: "Deleting groups...",
			success: "Groups deleted",
			error: "Failed to delete groups",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Group${plural}`,
				description: `This revokes all grants tied to the selected group${plural}.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
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
