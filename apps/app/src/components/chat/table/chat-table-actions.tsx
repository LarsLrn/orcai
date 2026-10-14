import type { ChatListRow } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteChatsMutation } from "@/hooks/mutations/use-chat-mutation";
import { m } from "@/paraglide/messages";

const ChatTableActions = () => {
	const { table } = useTable();
	const deleteChats = useDeleteChatsMutation({
		onSuccess: () => table.resetRowSelection(),
	});

	return (
		<DataTableBulkActions<ChatListRow>
			isPending={deleteChats.isPending}
			actions={[
				{
					label: m.chat_table_bulk_delete_action(),
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						deleteChats.mutate({
							refs: selectedRows.map((row) => ({
								id: row.original.id,
							})),
						}),
				},
			]}
		/>
	);
};

export { ChatTableActions };
