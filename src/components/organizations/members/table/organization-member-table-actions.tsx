import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReplaceAllIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Organization } from "@/db/schema/organization";
import { organizationMemberQueryOptions } from "@/lib/query-options/organization-member";

const OrganizationMemberTableActions = ({
	organizationId,
}: {
	organizationId: Organization["id"];
}) => {
	const { table } = useTable();
	const queryClient = useQueryClient();
	const { mutateAsync: deleteMember } = useMutation(
		organizationMemberQueryOptions.delete(queryClient),
	);

	const handleDelete = () => {
		const userIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(
			Promise.all(
				userIds.map((userId) =>
					deleteMember({
						organizationId,
						refs: [{ userId }],
					}),
				),
			),
			{
				loading: "Deleting organisation members...",
				success: "Organisation members deleted",
				error: (error) => ({
					message: "Failed to delete organisation members",
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
					Remove selected members
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { OrganizationMemberTableActions };
