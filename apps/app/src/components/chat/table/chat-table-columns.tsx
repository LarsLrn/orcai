import type { ChatListRow } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";

const columnHelper = createColumnHelper<DataTableFeatures, ChatListRow>();

export const chatTableColumns = columnHelper.columns([
	createDataTableSelectColumn<ChatListRow>(),
	columnHelper.accessor("title", {
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
	}),
	columnHelper.accessor("botName", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Attached Bot" />
		),
		cell: ({ row }) => row.original.botName ?? "—",
	}),
	columnHelper.accessor("updatedAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Date" />
		),
		cell: ({ row }) =>
			row.original.updatedAt
				? format(row.original.updatedAt, "MMM dd, yyyy HH:mm")
				: "—",
	}),
	columnHelper.display({
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
	}),
]);
