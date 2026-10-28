import type { InstanceUser } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { InstanceUserRowMenu } from "@/components/users/instance-user-actions";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { formatCount } from "@/lib/presentation/format-number";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, InstanceUser>();

export const instanceUserTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 300,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<Link
				to="/instance/users/$userId"
				params={{
					userId: row.original.id,
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
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_email_label()} />
		),
		meta: {
			label: m.common_email_label,
		},
	}),
	columnHelper.display({
		id: "organisations",
		header: () => m.instance_users_table_organisations_column_header(),
		cell: ({ row }) =>
			row.original.membershipCount === 0 ? (
				<span className="text-muted-foreground">
					{m.instance_users_table_no_organisation_label()}
				</span>
			) : (
				<span>{formatCount(row.original.membershipCount)}</span>
			),
	}),
	columnHelper.display({
		id: "instanceRole",
		header: () => m.instance_users_table_instance_role_column_header(),
		cell: ({ row }) =>
			isInstanceAdminRole(row.original.role) ? (
				<Badge variant="secondary">
					{m.instance_users_table_instance_role_admin_label()}
				</Badge>
			) : (
				<span className="text-muted-foreground">
					{m.instance_users_table_instance_role_user_label()}
				</span>
			),
	}),
	columnHelper.display({
		id: "status",
		header: () => m.common_status_column_header(),
		cell: ({ row }) =>
			row.original.banned ? (
				<Badge variant="destructive">
					{m.instance_users_table_status_banned_label()}
				</Badge>
			) : (
				<span>{m.common_status_active_label()}</span>
			),
	}),
	columnHelper.display({
		id: "twoFactor",
		header: () => m.instance_users_table_two_factor_column_header(),
		cell: ({ row }) =>
			row.original.twoFactorEnabled ? (
				<Badge variant="success">
					{m.instance_users_table_two_factor_on_label()}
				</Badge>
			) : (
				<span className="text-muted-foreground">
					{m.instance_users_table_two_factor_off_label()}
				</span>
			),
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
		cell: ({ row }) => <InstanceUserRowMenu user={row.original} />,
	}),
]);
