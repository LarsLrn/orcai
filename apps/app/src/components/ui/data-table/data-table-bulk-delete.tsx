import type { MutationActionResult } from "@/hooks/actions/use-mutation-action";
import { m } from "@/paraglide/messages";
import { DataTableBulkActions } from "./data-table-bulk-actions";
import { useTable } from "./data-table-context";

/** Deletes the selected rows through a delete action, clearing the selection once they are gone. */
const DataTableBulkDelete = <TId,>({
	action,
	label = m.common_delete_selected_action(),
}: {
	action: {
		mutateAsync: (input: {
			refs: {
				id: TId;
			}[];
		}) => Promise<MutationActionResult<unknown, unknown>>;
		isPending: boolean;
	};
	label?: string;
}) => {
	const { table } = useTable<{
		id: TId;
	}>();

	return (
		<DataTableBulkActions<{
			id: TId;
		}>
			isPending={action.isPending}
			actions={[
				{
					label,
					variant: "destructive",
					onSelect: async ({ selectedRows }) => {
						const result = await action.mutateAsync({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						});
						if (result.status === "success") table.resetRowSelection();
					},
				},
			]}
		/>
	);
};

export { DataTableBulkDelete };
