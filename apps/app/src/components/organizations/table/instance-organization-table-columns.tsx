import type { OrganizationWithMemberCount } from "@orcai/schema";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { DeleteOrganizationDialog } from "@/components/organizations/delete-organization-dialog";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenuTrigger } from "@/components/ui/shell/actions";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationWithMemberCount
>();

export const instanceOrganizationTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 400,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor("slug", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.instance_orgs_table_slug_column_header()}
			/>
		),
		meta: {
			label: m.instance_orgs_table_slug_column_header,
		},
	}),
	columnHelper.accessor("memberCount", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.instance_orgs_table_members_column_header()}
			/>
		),
		meta: {
			label: m.instance_orgs_table_members_column_header,
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
		cell: ({ row }) => (
			<InstanceOrganizationRowActions organization={row.original} />
		),
	}),
]);

const InstanceOrganizationRowActions = ({
	organization,
}: {
	organization: OrganizationWithMemberCount;
}) => {
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<OverflowMenuTrigger variant="ghost" />} />
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setIsDeleteOpen(true)}
					>
						{m.instance_orgs_table_delete_menu_item()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<DeleteOrganizationDialog
				organizationId={organization.id}
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
			/>
		</>
	);
};
