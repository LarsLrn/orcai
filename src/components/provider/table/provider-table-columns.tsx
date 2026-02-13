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
import type { Provider } from "@/lib/orpc/schemas/provider";

export const providerTableColumns: ColumnDef<Provider>[] = [
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
		size: 300,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/providers/$providerId"
				params={{ providerId: row.original.id }}
			>
				{row.original.name}
			</Link>
		),
	},
	{
		accessorKey: "enabled",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<Badge variant={row.original.enabled ? "default" : "destructive"}>
				{row.original.enabled ? "Active" : "Inactive"}
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
		accessorKey: "updatedAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Updated At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.updatedAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => {
			const provider = row.original;

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
							to={"/app/providers/$providerId"}
							params={{
								providerId: row.original.id,
							}}
						>
							<DropdownMenuItem>View Provider</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/providers/$providerId/edit"}
							params={{
								providerId: row.original.id,
							}}
						>
							<DropdownMenuItem>Edit Provider</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem provider={provider} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ provider }: { provider: Provider }) => {
	const { mutateAsync: deleteProviders } = useMutation(
		orpc.provider.delete.mutationOptions(),
	);

	const handleDelete = (provider: Provider) => {
		toast.promise(
			deleteProviders({
				refs: [{ id: provider.id }],
			}),
			{
				loading: "Deleting provider...",
				success: "Provider deleted",
				error: (error) => ({
					message: "Failed to delete provider",
					description: error.message,
				}),
			},
		);
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(provider)}
		>
			Delete Provider
		</DropdownMenuItem>
	);
};
