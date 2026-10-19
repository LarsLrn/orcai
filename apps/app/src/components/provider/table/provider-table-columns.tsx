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
import {
	getProviderStatusLabel,
	getProviderStatusVariant,
} from "@/lib/presentation/provider-status";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, Provider>();

export const providerTableColumns = columnHelper.columns([
	createDataTableSelectColumn<Provider>(),
	columnHelper.accessor("name", {
		size: 300,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
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
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor("enabled", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_status_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={getProviderStatusVariant(row.original.enabled)}>
				{getProviderStatusLabel(row.original.enabled)}
			</Badge>
		),
		meta: {
			label: m.common_status_column_header,
		},
	}),
	columnHelper.accessor("meteringMode", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.providers_table_metering_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant="outline">{row.original.meteringMode}</Badge>
		),
		meta: {
			label: m.providers_table_metering_column_header,
		},
	}),
	columnHelper.accessor("createdAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_created_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.createdAt || "")}</span>
		),
		meta: {
			label: m.common_created_column_header,
		},
	}),
	columnHelper.accessor("updatedAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.providers_table_updated_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.updatedAt || "")}</span>
		),
		meta: {
			label: m.providers_table_updated_column_header,
		},
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
								<span className="sr-only">{m.common_row_menu_trigger()}</span>
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
							<DropdownMenuItem>
								{m.providers_table_view_menu_item()}
							</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/providers/$providerId/edit"}
							params={{
								providerId: row.original.id,
							}}
						>
							<DropdownMenuItem>
								{m.providers_table_edit_menu_item()}
							</DropdownMenuItem>
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
			{m.providers_table_delete_menu_item()}
		</DropdownMenuItem>
	);
};
