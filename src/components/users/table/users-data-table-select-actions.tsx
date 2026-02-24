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
import { authClient } from "@/lib/auth/auth-client";

const UsersDataTableSelectActions = () => {
	const { table } = useTable();

	const handleDelete = () => {
		const userIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(
			Promise.all(
				userIds.map((userId) => authClient.admin.removeUser({ userId })),
			),
			{
				loading: "Deleting users...",
				success: "Users deleted",
				error: (error) => ({
					message: "Failed to delete users",
					description: error.message,
				}),
			},
		);
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

export { UsersDataTableSelectActions };
