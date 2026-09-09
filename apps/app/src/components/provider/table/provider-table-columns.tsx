import type { Provider } from "@orcai/schema";
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
import { useDeleteProvidersMutation } from "@/hooks/mutations/use-provider-mutations";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";

const columnHelper = createColumnHelper<DataTableFeatures, Provider>();

export const providerTableColumns = columnHelper.columns([
	createDataTableSelectColumn<Provider>(),
	columnHelper.accessor("name", {
		size: 300,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/providers/$providerId"
				params={{
					providerId: row.original.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.name}
			</Link>
		),
	}),
	columnHelper.accessor("enabled", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<Badge variant={row.original.enabled ? "success" : "secondary"}>
				{row.original.enabled ? "Active" : "Inactive"}
			</Badge>
		),
	}),
	columnHelper.accessor("meteringMode", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Metering" />
		),
		cell: ({ row }) => (
			<Badge variant="outline">{row.original.meteringMode}</Badge>
		),
	}),
	columnHelper.accessor("createdAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created" />
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.createdAt || "")}</span>
		),
	}),
	columnHelper.accessor("updatedAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Updated" />
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.updatedAt || "")}</span>
		),
	}),
	columnHelper.display({
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
							<DropdownMenuItem>View provider</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/providers/$providerId/edit"}
							params={{
								providerId: row.original.id,
							}}
						>
							<DropdownMenuItem>Edit provider</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem provider={provider} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	}),
]);

const DeleteItem = ({ provider }: { provider: Provider }) => {
	const { mutate: deleteProviders } = useDeleteProvidersMutation(
		{},
		{
			names: [
				provider.name,
			],
		},
	);

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
			Delete provider
		</DropdownMenuItem>
	);
};
