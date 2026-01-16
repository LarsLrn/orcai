import { useMutation } from "@tanstack/react-query";
import { ReplaceAllIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc/orpc";

const CoursesDataTableSelectActions = () => {
	const { table } = useTable();

	const { mutateAsync: deleteCourses } = useMutation(
		orpc.course.delete.mutationOptions(),
	);

	if (!table) return null;

	const handleDelete = () => {
		const courseIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(deleteCourses({ refs: courseIds.map((id) => ({ id })) }), {
			loading: "Deleting courses...",
			success: "Courses deleted",
			error: (error) => ({
				message: "Failed to delete courses",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="h-8">
						<ReplaceAllIcon />
						Actions
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-50">
				<DropdownMenuItem
					variant="destructive"
					onClick={handleDelete}
					disabled={table.getSelectedRowModel().rows.length === 0}
				>
					Delete selected
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { CoursesDataTableSelectActions };
