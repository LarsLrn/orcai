import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { ReplaceAllIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc/orpc";

const InvitesTableActions = () => {
	const { mutateAsync: deleteInvitations } = useMutation(
		orpc.courseInvitation.delete.mutationOptions(),
	);

	const { table } = useTable();

	const handleDelete = () => {
		const courseInvitationIds = table
			.getSelectedRowModel()
			.flatRows.map((row) => row.id);

		toast.promise(
			deleteInvitations({
				courseId: "placeholder", // TODO: Replace with actual courseId
				refs: courseInvitationIds.map((id) => ({ id })),
			}),
			{
				loading: "Deleting course invitations...",
				success: "Course invitations deleted",
				error: (error) => ({
					message: "Failed to delete course invitations",
					description: error.message,
				}),
			},
		);
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
					Delete selected
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { InvitesTableActions };
