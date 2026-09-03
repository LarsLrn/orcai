import type { ModelListRow } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
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
import { useDeleteModelsMutation } from "@/hooks/mutations/use-model-mutations";

const columnHelper = createColumnHelper<DataTableFeatures, ModelListRow>();

export const modelTableColumns = columnHelper.columns([
	createDataTableSelectColumn<ModelListRow>(),
	columnHelper.accessor("name", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/models/$modelId"
				params={{
					modelId: row.original.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.name}
			</Link>
		),
	}),
	columnHelper.accessor((row) => row.provider.name, {
		id: "providerName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Provider" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/providers/$providerId"
				params={{
					providerId: row.original.provider.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.provider.name}
			</Link>
		),
	}),
	columnHelper.accessor("isDeprecated", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<Badge variant={row.original.isDeprecated ? "destructive" : "default"}>
				{row.original.isDeprecated ? "Deprecated" : "Available"}
			</Badge>
		),
	}),
	columnHelper.accessor("createdAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
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
	}),
]);

const DeleteItem = ({ model }: { model: ModelListRow }) => {
	const { mutate: deleteModels } = useDeleteModelsMutation();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteModels({
					refs: [
						{
							id: model.id,
						},
					],
				})
			}
		>
			Delete Model
		</DropdownMenuItem>
	);
};
