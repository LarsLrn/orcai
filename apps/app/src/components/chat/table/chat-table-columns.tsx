import type { ChatListRow } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import { BranchMark } from "@/components/chat/branch-links";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { PinMark } from "@/components/chat/pin-mark";
import { SearchSnippet } from "@/components/chat/search-snippet";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, ChatListRow>();

export const chatTableColumns = columnHelper.columns([
	createDataTableSelectColumn<ChatListRow>(),
	columnHelper.accessor("title", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => {
			const { id, kind, match, parentChatId, pinnedAt, title } = row.original;
			return (
				<div className="flex min-w-0 flex-col gap-0.5">
					<Link
						to={
							kind === "assistant"
								? "/app/assistant/$chatId"
								: "/app/chat/$chatId"
						}
						params={{
							chatId: id,
						}}
						search={{
							message: match?.messageId,
						}}
						className="inline-flex max-w-full items-center gap-1.5 font-medium hover:underline"
					>
						{pinnedAt && <PinMark />}
						{parentChatId && <BranchMark />}
						<span className="truncate">
							{title ?? m.chat_title_placeholder()}
						</span>
					</Link>
					{match && <SearchSnippet snippet={match.snippet} />}
				</div>
			);
		},
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor("botName", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.chat_table_bot_column_header()}
			/>
		),
		cell: ({ row }) =>
			row.original.kind === "assistant"
				? m.assistant_name()
				: (row.original.botName ?? "—"),
		meta: {
			label: m.chat_table_bot_column_header,
		},
	}),
	columnHelper.accessor("updatedAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.chat_table_date_column_header()}
			/>
		),
		cell: ({ row }) =>
			row.original.updatedAt
				? formatDisplayTimestamp(row.original.updatedAt)
				: "—",
		meta: {
			label: m.chat_table_date_column_header,
		},
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => (
			<ChatActionsDropdown
				chatId={row.original.id}
				title={row.original.title}
				pinned={
					row.original.kind === "chat"
						? row.original.pinnedAt !== null
						: undefined
				}
			>
				<Button variant="ghost" className="size-8 p-0">
					<MoreHorizontalIcon />
					<span className="sr-only">{m.chat_table_row_menu_trigger()}</span>
				</Button>
			</ChatActionsDropdown>
		),
	}),
]);
