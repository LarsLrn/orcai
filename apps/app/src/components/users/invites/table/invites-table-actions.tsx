import type { OrganizationInvitation } from "@orcai/schema";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { m } from "@/paraglide/messages";

const InvitesTableActions = () => {
	const { table } = useTable();
	const deleteInvitations = useDeleteOrganizationInvitationsMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});

	const handleDelete = (selectedInvitations: OrganizationInvitation[]) => {
		deleteInvitations.mutate({
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
					label: m.common_delete_selected_action(),
					variant: "destructive",
					onSelect: ({ selectedRows }) =>
						handleDelete(selectedRows.map((row) => row.original)),
				},
			]}
		/>
	);
};

export { InvitesTableActions };
