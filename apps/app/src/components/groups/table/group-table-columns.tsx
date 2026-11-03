import type { GroupListRow } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { createDataTableActionsColumn } from "@/components/ui/data-table/data-table-actions-column";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteGroupsMutation } from "@/hooks/mutations/use-group-mutations";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, GroupListRow>();

const useGroupRowActions = (group: GroupListRow) => {
	const { mutate: deleteGroups } = useDeleteGroupsMutation({
		names: [
			group.name,
		],
	});

	return {
		actions: [
			{
				key: "manage",
				label: m.groups_table_manage_action(),
				linkProps: {
					to: "/app/groups/$groupId",
					params: {
						groupId: group.id,
					},
				},
			},
			group.kind === "custom" && {
				key: "delete",
				label: m.groups_delete_action(),
				destructive: true,
				onClick: () =>
					deleteGroups({
						refs: [
							{
								id: group.id,
							},
						],
					}),
			},
		] satisfies (HeaderAction | false)[],
	};
};

export const groupTableColumns = columnHelper.columns([
	createDataTableSelectColumn<GroupListRow>(),
	columnHelper.accessor("name", {
		size: 440,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<div className="min-w-0">
				<Link
					to="/app/groups/$groupId"
					params={{
						groupId: row.original.id,
					}}
					className="truncate text-sm font-medium hover:underline"
				>
					{row.original.name}
				</Link>
				{row.original.description && (
					<p className="text-muted-foreground truncate text-xs">
						{row.original.description}
					</p>
				)}
			</div>
		),
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor("kind", {
		size: 160,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.groups_table_kind_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={row.original.kind === "system" ? "outline" : "secondary"}>
				{row.original.kind === "system"
					? m.groups_kind_system()
					: m.groups_kind_custom()}
			</Badge>
		),
		meta: {
			label: m.groups_table_kind_column_header,
		},
	}),
	columnHelper.accessor("memberCount", {
		size: 120,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.groups_table_members_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatCount(row.original.memberCount)}
			</span>
		),
		meta: {
			label: m.groups_table_members_column_header,
		},
	}),
	createDataTableActionsColumn(useGroupRowActions),
]);
