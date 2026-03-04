import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOrganizationMembersMutation } from "@/hooks/mutations/use-organization-member-mutations";
import type { Organization } from "@/lib/orpc/schemas/organization";

const OrganizationMemberTableActions = ({
	organizationId,
}: {
	organizationId: Organization["id"];
}) => {
	const { table } = useTable();
	const { mutate: deleteMembers } = useDeleteOrganizationMembersMutation();

	const handleDelete = () => {
		const userIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		deleteMembers({
			organizationId,
			refs: userIds.map((userId) => ({
				userId,
			})),
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
					Remove selected members
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { OrganizationMemberTableActions };
