import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import type { Model } from "@/lib/orpc/schemas/model";

export const modelTableColumns: ColumnDef<Model>[] = [
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
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link to="/app/models/$modelId" params={{ modelId: row.original.id }}>
				{row.original.name}
			</Link>
		),
	},
	{
		accessorKey: "providerId",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Provider" />
		),
	},
	{
		accessorKey: "isDeprecated",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<Badge variant={row.original.isDeprecated ? "destructive" : "default"}>
				{row.original.isDeprecated ? "Deprecated" : "Available"}
			</Badge>
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
			const model = row.original;

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
							to={"/app/models/$modelId"}
							params={{
								modelId: model.id,
							}}
						>
							<DropdownMenuItem>View Model</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/models/$modelId/edit"}
							params={{
								modelId: model.id,
							}}
						>
							<DropdownMenuItem>Edit Model</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem model={model} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ model }: { model: Model }) => {
	const { mutateAsync: deleteModels } = useMutation(
		orpc.model.delete.mutationOptions(),
	);

	const handleDelete = (model: Model) => {
		toast.promise(
			deleteModels({
				refs: [{ id: model.id }],
			}),
			{
				loading: "Deleting model...",
				success: "Model deleted",
				error: (error) => ({
					message: "Failed to delete model",
					description: error.message,
				}),
			},
		);
	};

	return (
		<DropdownMenuItem variant="destructive" onClick={() => handleDelete(model)}>
			Delete Model
		</DropdownMenuItem>
	);
};
