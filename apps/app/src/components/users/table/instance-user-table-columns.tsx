import type { UserWithMemberships } from "@orcai/schema";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
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
import { organizationRoleLabels } from "@/lib/authz/organization-role-metadata";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	UserWithMemberships
>();

export const instanceUserTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 300,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
	}),
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Email" />
		),
	}),
	columnHelper.display({
		id: "organisations",
		header: "Organisations",
		cell: ({ row }) =>
			row.original.memberships.length === 0 ? (
				<span className="text-muted-foreground">No organisation</span>
			) : (
				<span>
					{row.original.memberships
						.map(
							(membership) =>
								`${membership.organizationName} (${organizationRoleLabels[membership.role]})`,
						)
						.join(", ")}
				</span>
			),
	}),
	columnHelper.display({
		id: "status",
		header: "Status",
		cell: ({ row }) =>
			row.original.banned ? (
				<Badge variant="destructive">Banned</Badge>
			) : (
				<span>Active</span>
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
		cell: ({ row }) => <InstanceUserActions user={row.original} />,
	}),
]);

const InstanceUserActions = ({ user }: { user: UserWithMemberships }) => {
	const { auth } = useAuthenticatedRouteContext();
	const { mutate: banUser } = useBanUserMutation();
	const { mutate: unbanUser } = useUnbanUserMutation();
	const { mutate: deleteUsers } = useDeleteUsersMutation();

	if (user.id === auth.user.id) {
		return null;
	}

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
				{user.banned ? (
					<DropdownMenuItem
						onClick={() =>
							unbanUser({
								userId: user.id,
							})
						}
					>
						Unban Account
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem
						onClick={() =>
							banUser({
								userId: user.id,
							})
						}
					>
						Ban Account
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
					Delete Account
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
