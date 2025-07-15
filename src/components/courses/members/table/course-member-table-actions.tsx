import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
/* import { removeCourseMembers } from "@/db/actions/course"; */
import type { Course } from "@/db/schema/course";

const CourseMemberTableActions = ({ courseId }: { courseId: Course["id"] }) => {
	const { table } = useTable();

	const handleDelete = async () => {
		const _userIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		/* toast.promise(
      withToastPromise(
        removeCourseMembers({ refs: userIds.map((id) => ({ id })), courseId }),
      ),
      {
        loading: "Deleting course members...",
        success: "Course members deleted",
        error: (error) => ({
          message: "Failed to delete course members",
          description: error.message,
        }),
      },
    ); */
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8">
					<ReplaceAllIcon />
					Actions
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px]">
				<DropdownMenuItem
					variant="destructive"
					onClick={handleDelete}
					disabled={table.getSelectedRowModel().rows.length === 0}
				>
					Remove selected members
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { CourseMemberTableActions };
