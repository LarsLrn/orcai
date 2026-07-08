import type { UserWithOrganizationRole } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
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
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";

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
		accessorKey: "organizationRole",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Organization Role" />
		),
	},
	{
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const user = row.original;

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
						<DropdownMenuSeparator />
						<DeleteItem userId={user.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ userId }: { userId: string }) => {
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
