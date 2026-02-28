import { useRouteContext } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOrganizationMembersMutation } from "@/hooks/mutations/use-organization-member-mutations";
import type { Organization } from "@/lib/orpc/schemas/organization";
import type { User } from "@/lib/orpc/schemas/user";

export const organizationMemberTableColumns: ColumnDef<User>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected()}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
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
		accessorKey: "role",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Role" />
		),
	},
	{
		id: "actions",
		size: 32,
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
						<DeleteItem userId={user.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ userId }: { userId: User["id"] }) => {
	const { auth } = useRouteContext({ from: "/app" });
	const organizationId = auth.session.activeOrganizationId;
	const { mutate: deleteMembers } = useDeleteOrganizationMembersMutation();

	const handleDelete = (
		userId: User["id"],
		organizationId: Organization["id"],
	) => {
		deleteMembers({ organizationId, refs: [{ userId }] });
	};

	if (!organizationId) {
		return (
			<DropdownMenuItem
				variant="destructive"
				onClick={() =>
					toast.error("Organisation ID is required", {
						description: "Try switching your active organisation.",
					})
				}
			>
				Remove Member
			</DropdownMenuItem>
		);
	}

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(userId, organizationId)}
		>
			Remove Member
		</DropdownMenuItem>
	);
};
