import type { OrganizationWithMemberCount } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { DeleteOrganizationDialog } from "@/components/organizations/delete-organization-dialog";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { DisplayTimestamp } from "@/components/ui/composed/display-time";
import { createDataTableActionsColumn } from "@/components/ui/data-table/data-table-actions-column";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationWithMemberCount
>();

const useInstanceOrganizationRowActions = (
	organization: OrganizationWithMemberCount,
) => {
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	return {
		actions: [
			{
				key: "delete",
				label: m.instance_orgs_table_delete_menu_item(),
				destructive: true,
				onClick: () => setIsDeleteOpen(true),
			},
		] satisfies HeaderAction[],
		dialog: (
			<DeleteOrganizationDialog
				organizationId={organization.id}
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
			/>
		),
	};
};

export const instanceOrganizationTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 400,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<OrganizationLogo organization={row.original} size="sm" />
				<Link
					to="/instance/organizations/$organizationId"
					params={{
						organizationId: row.original.id,
					}}
					className="font-medium hover:underline"
				>
					{row.original.name}
				</Link>
			</div>
		),
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
			<span>
				<DisplayTimestamp value={row.original.createdAt || ""} />
			</span>
		),
		meta: {
			label: m.common_created_column_header,
		},
	}),
	createDataTableActionsColumn(useInstanceOrganizationRowActions),
]);
