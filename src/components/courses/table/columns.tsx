import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import type { Course } from "@/db/schema/course";
import { orpc } from "@/lib/orpc/orpc";

export const columns: ColumnDef<Course>[] = [
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
		accessorKey: "title",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Title" />
		),
		cell: ({ row }) => (
			<Link to="/app/courses/$courseId" params={{ courseId: row.original.id }}>
				{row.original.title}
			</Link>
		),
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => {
			const course = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<Link to="/app/courses/$courseId" params={{ courseId: course.id }}>
							<DropdownMenuItem>View Course</DropdownMenuItem>
						</Link>
						<Link
							to="/app/courses/$courseId/edit"
							params={{ courseId: course.id }}
						>
							<DropdownMenuItem>Edit Course</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem courseId={course.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({ courseId }: { courseId: Course["id"] }) => {
	const queryClient = useQueryClient();

	const { mutateAsync: deleteCourses } = useMutation(
		orpc.course.delete.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: ["courses"],
				});
			},
			onError(error) {
				console.error(error);
				alert(error.message);
			},
		}),
	);

	const handleDelete = async (id: string) => {
		toast.promise(deleteCourses({ refs: [{ id }] }), {
			loading: "Deleting course...",
			success: "Course deleted",
			error: (error) => ({
				message: "Failed to delete course",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(courseId)}
		>
			Delete Course
		</DropdownMenuItem>
	);
};
