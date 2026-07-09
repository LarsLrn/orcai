import type { ChatListRow } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";

export const chatTableColumns: ColumnDef<ChatListRow>[] = [
	createDataTableSelectColumn<ChatListRow>(),
	{
		accessorKey: "title",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/chat/$chatId"
				params={{
					chatId: row.original.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.title || "Untitled chat"}
			</Link>
		),
	},
	{
		accessorKey: "botName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Attached Bot" />
		),
		cell: ({ row }) => row.original.botName ?? "—",
	},
	{
		accessorKey: "updatedAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Date" />
		),
		cell: ({ row }) =>
			row.original.updatedAt
				? format(row.original.updatedAt, "MMM dd, yyyy HH:mm")
				: "—",
	},
	{
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => (
			<ChatActionsDropdown chatId={row.original.id} title={row.original.title}>
				<Button variant="ghost" className="size-8 p-0">
					<MoreHorizontalIcon />
					<span className="sr-only">Open chat actions</span>
				</Button>
			</ChatActionsDropdown>
		),
	},
];
