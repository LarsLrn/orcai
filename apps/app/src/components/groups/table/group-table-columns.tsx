import type { Group } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteGroupsMutation } from "@/hooks/mutations/use-group-mutations";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, Group>();

export const groupTableColumns = columnHelper.columns([
	createDataTableSelectColumn<Group>(),
	columnHelper.accessor("name", {
		size: 440,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<div className="min-w-0">
				<Link
					to="/app/groups/$groupId"
					params={{
						groupId: row.original.id,
					}}
					className="truncate font-medium text-sm hover:underline"
				>
					{row.original.name}
				</Link>
				{row.original.description && (
					<p className="truncate text-muted-foreground text-xs">
						{row.original.description}
					</p>
				)}
			</div>
		),
	}),
	columnHelper.accessor("kind", {
		size: 160,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.groups_table_kind_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={row.original.kind === "system" ? "outline" : "secondary"}>
				{row.original.kind === "system"
					? m.groups_kind_system()
					: m.groups_kind_custom()}
			</Badge>
		),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => <ActionCell group={row.original} />,
	}),
]);

const ActionCell = ({ group }: { group: Group }) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" className="size-8 p-0">
						<span className="sr-only">{m.common_row_menu_trigger()}</span>
						<MoreHorizontal className="size-4" />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<Link
					to="/app/groups/$groupId"
					params={{
						groupId: group.id,
					}}
				>
					<DropdownMenuItem>{m.groups_table_manage_action()}</DropdownMenuItem>
				</Link>
				{group.kind === "custom" && (
					<>
						<DropdownMenuSeparator />
						<DeleteGroupItem group={group} />
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteGroupItem = ({ group }: { group: Group }) => {
	const deleteGroup = useDeleteGroupsMutation(
		{},
		{
			names: [
				group.name,
			],
		},
	);

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteGroup.mutate({
					refs: [
						{
							id: group.id,
						},
					],
				})
			}
		>
			{m.groups_delete_action()}
		</DropdownMenuItem>
	);
};
