import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CourseInvitation } from "@/db/schema/course-invitation";
import { orpc } from "@/lib/orpc/orpc";

const handleCopy = async (id: CourseInvitation["id"]) => {
	// TODO: Replace with actual URL generation logic (useRouter)
	const url = `${process.env.NEXT_PUBLIC_BASE_URL}/signup?invitationId=${id}`;

	toast.promise(navigator.clipboard.writeText(url), {
		loading: "Copying invitation link...",
		success: "Invitation link copied",
		error: (error) => ({
			message: "Failed to copy invitation link",
			description: error.message,
		}),
	});
};

export const invitesTableColumns: ColumnDef<CourseInvitation>[] = [
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
		accessorKey: "email",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
	},
	{
		accessorKey: "id",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Invitation ID" />
		),
	},
	{
		accessorKey: "expiresAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expires At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.expiresAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		accessorKey: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
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
			const invitation = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => handleCopy(invitation.id)}>
							Copy Invitation Link
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DeleteItem invitationId={invitation.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({
	invitationId,
}: {
	invitationId: CourseInvitation["id"];
}) => {
	const queryClient = useQueryClient();

	const { mutateAsync: deleteInvitations } = useMutation(
		orpc.courseInvitation.delete.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.list.key(),
				});
			},
			onError(error) {
				console.error(error);
				alert(error.message);
			},
		}),
	);

	const handleDelete = async (id: CourseInvitation["id"]) => {
		toast.promise(
			// TODO: Replace with actual courseId
			deleteInvitations({ courseId: "placeholder", refs: [{ id }] }),
			{
				loading: "Deleting course invitation...",
				success: "Course invitation deleted",
				error: (error) => ({
					message: "Failed to delete course invitation",
					description: error.message,
				}),
			},
		);
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(invitationId)}
		>
			Delete Course
		</DropdownMenuItem>
	);
};
