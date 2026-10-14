import type { OrganizationInvitation } from "@orcai/schema";
import { toast } from "sonner";
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
		const organizationIds = new Set(
			selectedInvitations.map((invitation) => invitation.organizationId),
		);

		if (organizationIds.size > 1) {
			toast.error(m.users_invites_bulk_mixed_organisations_error_title(), {
				description:
					m.users_invites_bulk_mixed_organisations_error_description(),
			});
			return;
		}

		const organizationId = selectedInvitations[0]?.organizationId;

		if (!organizationId) {
			toast.error(m.users_invites_bulk_no_organisation_error());
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
