import type { UserWithMemberships } from "@orcai/schema";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import {
	useBanUserMutation,
	useDeleteUsersMutation,
	useUnbanUserMutation,
} from "@/hooks/mutations/use-user-admin-mutations";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	UserWithMemberships
>();

export const instanceUserTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 300,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
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
			row.original.memberships.length === 0 ? (
				<span className="text-muted-foreground">
					{m.instance_users_table_no_organisation_label()}
				</span>
			) : (
				<span>
					{row.original.memberships
						.map(
							(membership) =>
								`${membership.organizationName} (${getOrganizationRoleLabel(membership.role)})`,
						)
						.join(", ")}
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
		cell: ({ row }) => <InstanceUserActions user={row.original} />,
	}),
]);

const InstanceUserActions = ({ user }: { user: UserWithMemberships }) => {
	const { auth } = useAuthenticatedRouteContext();
	const target = {
		names: [
			user.email,
		],
	};
	const { mutate: banUser } = useBanUserMutation({}, target);
	const { mutate: unbanUser } = useUnbanUserMutation();
	const { mutate: deleteUsers } = useDeleteUsersMutation({}, target);

	if (user.id === auth.user.id) {
		return null;
	}

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
				{user.banned ? (
					<DropdownMenuItem
						onClick={() =>
							unbanUser({
								userId: user.id,
							})
						}
					>
						{m.instance_users_table_unban_menu_item()}
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem
						onClick={() =>
							banUser({
								userId: user.id,
							})
						}
					>
						{m.instance_users_table_ban_menu_item()}
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onClick={() =>
						deleteUsers({
							userIds: [
								user.id,
							],
						})
					}
				>
					{m.instance_users_table_delete_menu_item()}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
