import type { InstanceUserMembership } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	InstanceUserMembership
>();

export const instanceUserMembershipColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<Link
				to="/instance/organizations/$organizationId"
				params={{
					organizationId: row.original.organizationId,
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
	columnHelper.accessor("role", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.instance_detail_role_column_header()}
			/>
		),
		cell: ({ row }) => getOrganizationRoleLabel(row.original.role),
		meta: {
			label: m.instance_detail_role_column_header,
		},
	}),
	columnHelper.accessor("joinedAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.instance_detail_joined_column_header()}
			/>
		),
		cell: ({ row }) =>
			row.original.joinedAt ? formatDisplayDate(row.original.joinedAt) : null,
		meta: {
			label: m.instance_detail_joined_column_header,
		},
	}),
]);
