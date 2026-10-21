import type { ModelListRow } from "@orcai/schema";
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
	DropdownMenuLinkItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteModelsMutation } from "@/hooks/mutations/use-model-mutations";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { getModelCapabilityLabel } from "@/lib/presentation/model-capability";
import {
	getModelStatusLabel,
	getModelStatusVariant,
} from "@/lib/presentation/model-status";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, ModelListRow>();

export const modelTableColumns = columnHelper.columns([
	createDataTableSelectColumn<ModelListRow>(),
	columnHelper.accessor("name", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
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
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor((row) => row.provider.name, {
		id: "providerName",
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_provider_label()}
			/>
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
		meta: {
			label: m.common_provider_label,
		},
	}),
	columnHelper.accessor("capabilities", {
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_capabilities_title()}
			/>
		),
		cell: ({ row }) =>
			row.original.capabilities.length === 0 ? (
				<Badge
					variant="warning"
					render={
						<Link
							to="/app/models/$modelId/edit"
							params={{
								modelId: row.original.id,
							}}
						/>
					}
				>
					{m.models_table_capabilities_unset_badge()}
				</Badge>
			) : (
				<div className="flex flex-wrap gap-1">
					{row.original.capabilities.map((capability) => (
						<Badge key={capability} variant="outline">
							{getModelCapabilityLabel(capability)}
						</Badge>
					))}
				</div>
			),
	}),
	columnHelper.accessor("isDeprecated", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_status_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={getModelStatusVariant(row.original.isDeprecated)}>
				{getModelStatusLabel(row.original.isDeprecated)}
			</Badge>
		),
		meta: {
			label: m.common_status_column_header,
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
								<span className="sr-only">{m.common_row_menu_trigger()}</span>
								<MoreHorizontal className="size-4" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end">
						<DropdownMenuLinkItem
							render={
								<Link
									to={"/app/models/$modelId"}
									params={{
										modelId: model.id,
									}}
								/>
							}
						>
							{m.models_table_view_menu_item()}
						</DropdownMenuLinkItem>
						<DropdownMenuLinkItem
							render={
								<Link
									to={"/app/models/$modelId/edit"}
									params={{
										modelId: model.id,
									}}
								/>
							}
						>
							{m.models_table_edit_menu_item()}
						</DropdownMenuLinkItem>
						<DropdownMenuSeparator />
						<DeleteItem model={model} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	}),
]);

const DeleteItem = ({ model }: { model: ModelListRow }) => {
	const { mutate: deleteModels } = useDeleteModelsMutation(
		{},
		{
			names: [
				model.name,
			],
		},
	);

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
			{m.models_table_delete_menu_item()}
		</DropdownMenuItem>
	);
};
