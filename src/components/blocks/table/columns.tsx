import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc/orpc";
import type { Block } from "@/lib/orpc/schemas/block";

export const columns: ColumnDef<Block>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		size: 500,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link to="/app/blocks/$blockId" params={{ blockId: row.original.id }}>
				{row.original.name}
			</Link>
		),
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => {
			const block = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<Link to="/app/blocks/$blockId" params={{ blockId: block.id }}>
							<DropdownMenuItem>View Block</DropdownMenuItem>
						</Link>
						<Link to="/app/blocks/$blockId/edit" params={{ blockId: block.id }}>
							<DropdownMenuItem>Edit Block</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem blockId={block.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ blockId }: { blockId: Block["id"] }) => {
	const { mutateAsync: deleteBlocks } = useMutation(
		orpc.block.delete.mutationOptions(),
	);

	const handleDelete = (id: string) => {
		toast.promise(deleteBlocks({ refs: [{ id }] }), {
			loading: "Deleting block...",
			success: "Block deleted",
			error: (error) => ({
				message: "Failed to delete block",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(blockId)}
		>
			Delete Block
		</DropdownMenuItem>
	);
};
