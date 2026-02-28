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
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import type { OrganizationInvitation } from "@/lib/orpc/schemas/organization-invitation";

const InvitesTableActions = () => {
	const { table } = useTable();
	const { mutate: deleteInvitations } =
		useDeleteOrganizationInvitationsMutation();

	const handleDelete = () => {
		const selectedInvitations = table
			.getSelectedRowModel()
			.flatRows.map((row) => row.original as OrganizationInvitation);

		const organizationIds = new Set(
			selectedInvitations.map((invitation) => invitation.organizationId),
		);

		if (organizationIds.size > 1) {
			toast.error("Mixed organizations selected", {
				description: "Please select invitations from a single organization.",
			});
			return;
		}

		const organizationId = selectedInvitations[0]?.organizationId;

		if (!organizationId) {
			toast.error("Organization ID is required");
			return;
		}

		deleteInvitations({
			organizationId,
			refs: selectedInvitations.map((invitation) => ({ id: invitation.id })),
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

export { InvitesTableActions };
