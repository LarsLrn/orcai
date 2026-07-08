import type { Provider } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
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
import { useDeleteProvidersMutation } from "@/hooks/mutations/use-provider-mutations";

export const providerTableColumns: ColumnDef<Provider>[] = [
	createDataTableSelectColumn<Provider>(),
	{
		size: 300,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/providers/$providerId"
				params={{
					providerId: row.original.id,
				}}
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
		accessorKey: "meteringMode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Metering" />
		),
		cell: ({ row }) => (
			<Badge variant="outline">{row.original.meteringMode}</Badge>
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
		enableSorting: false,
		enableHiding: false,
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
	const { mutate: deleteProviders } = useDeleteProvidersMutation();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteProviders({
					refs: [
						{
							id: provider.id,
						},
					],
				})
			}
		>
			Delete Provider
		</DropdownMenuItem>
	);
};
