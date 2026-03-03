import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
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
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import type { Block } from "@/lib/orpc/schemas/block";

export const columns: ColumnDef<Block>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected()}
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
			<Link to="/app/hub/blocks/$blockId" params={{ blockId: row.original.id }}>
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
		cell: ({ row }) => <ActionCell block={row.original} />,
	},
];

const ActionCell = ({ block }: { block: Block }) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);

	return (
		<>
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
					<Link to="/app/hub/blocks/$blockId" params={{ blockId: block.id }}>
						<DropdownMenuItem>View Block</DropdownMenuItem>
					</Link>
					<Link
						to="/app/hub/blocks/$blockId/edit"
						params={{ blockId: block.id }}
					>
						<DropdownMenuItem>Edit Block</DropdownMenuItem>
					</Link>
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault();
							setIsAccessOpen(true);
						}}
					>
						Manage Access
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DeleteItem blockId={block.id} />
				</DropdownMenuContent>
			</DropdownMenu>

			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{ type: "block", id: block.id }}
				resourceName={block.name}
			/>
		</>
	);
};

const DeleteItem = ({ blockId }: { blockId: Block["id"] }) => {
	const { mutate: deleteBlocks } = useDeleteBlocksMutation();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => deleteBlocks({ refs: [{ id: blockId }] })}
		>
			Delete Block
		</DropdownMenuItem>
	);
};
