import type { GroupId } from "@orcai/core";
import type { Group } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const groupTableColumns: ColumnDef<Group>[] = [
	createDataTableSelectColumn<Group>(),
	{
		size: 440,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
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
	},
	{
		size: 160,
		accessorKey: "kind",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Type" />
		),
		cell: ({ row }) => (
			<Badge variant={row.original.kind === "system" ? "outline" : "secondary"}>
				{row.original.kind === "system" ? "System" : "Custom"}
			</Badge>
		),
	},
	{
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => <ActionCell group={row.original} />,
	},
];

const ActionCell = ({ group }: { group: Group }) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" className="size-8 p-0">
						<span className="sr-only">Open menu</span>
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
					<DropdownMenuItem>Manage Group</DropdownMenuItem>
				</Link>
				{group.kind === "custom" && (
					<>
						<DropdownMenuSeparator />
						<DeleteGroupItem groupId={group.id} />
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteGroupItem = ({ groupId }: { groupId: GroupId }) => {
	const queryClient = useQueryClient();
	const deleteGroup = useMutationAction({
		mutationOptions: () =>
			orpc.group.delete.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.group.key(),
					});
				},
			}),
		messages: {
			loading: "Deleting group...",
			success: "Group deleted",
			error: "Failed to delete group",
		},
		confirm: {
			title: "Delete group",
			description: "This revokes all grants tied to this group.",
			confirmText: "Delete",
			cancelText: "Cancel",
		},
	});

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteGroup.mutate({
					refs: [
						{
							id: groupId,
						},
					],
				})
			}
		>
			Delete Group
		</DropdownMenuItem>
	);
};
