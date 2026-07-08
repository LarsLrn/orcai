import type { UserWithOrganizationRole } from "@orcai/schema";
import { Link, useRouteContext } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";
import { organizationRoleLabels } from "@/lib/authz/organization-role-metadata";

export const columns: ColumnDef<UserWithOrganizationRole>[] = [
	createDataTableSelectColumn<UserWithOrganizationRole>(),
	{
		size: 500,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
	},
	{
		accessorKey: "email",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Email" />
		),
	},
	{
		accessorKey: "emailVerified",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Email Verified" />
		),
		cell: ({ row }) =>
			row.original.emailVerified ? "Verified" : "Not verified",
	},
	{
		accessorKey: "organizationRole",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Organization Role" />
		),
		cell: ({ row }) => organizationRoleLabels[row.original.organizationRole],
	},
	{
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const user = row.original;

			return <UserActions user={user} />;
		},
	},
];

const UserActions = ({ user }: { user: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canDeleteUser =
		user.id !== auth.user.id &&
		(user.organizationRole !== "admin" || canManageOrganization);

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
					to={"/app/users/$userId/edit"}
					params={{
						userId: user.id,
					}}
				>
					<DropdownMenuItem>Edit User</DropdownMenuItem>
				</Link>
				{canDeleteUser ? (
					<>
						<DropdownMenuSeparator />
						<DeleteItem userId={user.id} />
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteItem = ({ userId }: { userId: UserWithOrganizationRole["id"] }) => {
	const { mutate: deleteUsers } = useDeleteUsersMutation();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteUsers({
					userIds: [
						userId,
					],
				})
			}
		>
			Delete User
		</DropdownMenuItem>
	);
};
