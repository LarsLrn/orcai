import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { convert } from "convert";
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
import { useDeleteAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import type { Asset } from "@/lib/orpc/schemas/asset";

export const columns: ColumnDef<Asset>[] = [
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
		accessorKey: "title",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Title" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/hub/assets/$assetId"
				params={{
					assetId: row.original.id,
				}}
			>
				{row.original.title}
			</Link>
		),
	},
	{
		accessorKey: "size",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Size" />
		),
		cell: ({ row }) => {
			return convert(row.original.size, "bytes").to("best").toString(2);
		},
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
		cell: ({ row }) => <ActionCell row={row} />,
	},
];

const ActionCell = ({ row }: { row: Row<Asset> }) => {
	const { mutate: deleteAssets } = useDeleteAssetsMutation();
	const asset = row.original;
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
					<Link
						to={"/app/hub/assets/$assetId"}
						params={{
							assetId: asset.id,
						}}
					>
						<DropdownMenuItem>View Asset</DropdownMenuItem>
					</Link>
					<Link
						to={"/app/hub/assets/$assetId/edit"}
						params={{
							assetId: asset.id,
						}}
					>
						<DropdownMenuItem>Edit Asset</DropdownMenuItem>
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
					<DropdownMenuItem
						variant="destructive"
						onClick={() =>
							deleteAssets({
								refs: [
									{
										id: asset.id,
									},
								],
							})
						}
					>
						Delete Asset
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "asset",
					id: asset.id,
				}}
				resourceName={asset.title}
			/>
		</>
	);
};
