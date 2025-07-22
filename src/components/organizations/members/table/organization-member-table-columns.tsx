import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { User } from "@/db/schema/auth";
import type { Organization } from "@/db/schema/organization";
import { orpc } from "@/lib/orpc/orpc";

export const organizationMemberTableColumns: ColumnDef<User>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
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
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DeleteItem userId={user.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ userId }: { userId: User["id"] }) => {
	const queryClient = useQueryClient();
	const { auth } = useRouteContext({ from: "/app" });
	const organizationId = auth.session.activeOrganizationId;

	const { mutateAsync: deleteMembers } = useMutation(
		orpc.organizationMember.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationMember.list.queryKey({
						input: {
							// TODO: Ensure active organization is set
							organizationId: organizationId ?? "",
						},
					}),
				});
			},
		}),
	);

	const handleDelete = (
		userId: User["id"],
		organizationId: Organization["id"],
	) => {
		toast.promise(deleteMembers({ organizationId, refs: [{ userId }] }), {
			loading: "Removing organisation member...",
			success: "Organisation member removed",
			error: (error) => ({
				message: "Failed to remove organisation member",
				description: error.message,
			}),
		});
	};

	if (!organizationId) {
		toast.error("Organisation ID is required", {
			description: "Try switching your active organisation.",
		});
		return null;
	}

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(userId, organizationId)}
		>
			Delete Organisation
		</DropdownMenuItem>
	);
};
