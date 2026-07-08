import type { OrganizationInvitation } from "@orcai/schema";
import { toast } from "sonner";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";

const InvitesTableActions = () => {
	const { table } = useTable();
	const deleteInvitations = useDeleteOrganizationInvitationsMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	const handleDelete = (selectedInvitations: OrganizationInvitation[]) => {
		const organizationIds = new Set(
			selectedInvitations.map((invitation) => invitation.organizationId),
		);

		if (organizationIds.size > 1) {
			toast.error("Mixed organisations selected", {
				description: "Please select invitations from a single organisation.",
			});
			return;
		}

		const organizationId = selectedInvitations[0]?.organizationId;

		if (!organizationId) {
			toast.error("Organisation ID is required");
			return;
		}

		deleteInvitations.mutate({
			organizationId,
			refs: selectedInvitations.map((invitation) => ({
				id: invitation.id,
			})),
		});
	};

	return (
		<DataTableBulkActions<OrganizationInvitation>
			isPending={deleteInvitations.isPending}
			actions={[
				{
					label: "Delete selected",
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						handleDelete(selectedRows.map((row) => row.original)),
				},
			]}
		/>
	);
};

export { InvitesTableActions };
