import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteCoursesMutation } from "@/hooks/mutations/use-course-mutations";

const CoursesDataTableSelectActions = () => {
	const { table } = useTable();
	const { mutate: deleteCourses } = useDeleteCoursesMutation();

	if (!table) return null;

	const handleDelete = () => {
		const courseIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		deleteCourses({ refs: courseIds.map((id) => ({ id })) });
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
