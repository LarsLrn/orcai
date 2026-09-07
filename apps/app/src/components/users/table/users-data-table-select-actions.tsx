import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import type { UserWithOrganizationRole } from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import { DataTableBulkActions } from "@/components/ui/data-table/data-table-bulk-actions";
import { useTable } from "@/components/ui/data-table/data-table-context";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useDeleteOrganizationMembersMutation } from "@/hooks/mutations/use-organization-member-mutations";

const UsersDataTableSelectActions = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { table } = useTable<UserWithOrganizationRole>();
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const removeMembers = useDeleteOrganizationMembersMutation({
		onSuccess: () => {
			table.resetRowSelection();
		},
	});
	const organizationId = auth.session.activeOrganizationId;
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const selectedRows = table.getSelectedRowModel().rows;
	const hasProtectedSelection = selectedRows.some(
		(row) =>
			row.original.id === auth.user.id ||
			(row.original.organizationRole === ORGANIZATION_ADMIN_ROLE &&
				!canManageOrganization),
	);

	return (
		<DataTableBulkActions<UserWithOrganizationRole>
			isPending={removeMembers.isPending}
			actions={
				hasProtectedSelection || !organizationId
					? []
					: [
							{
								label: "Remove selected from organisation",
								variant: "destructive",
								onSelect: ({ selectedRows }) =>
									removeMembers.mutate({
										organizationId,
										refs: selectedRows.map((row) => ({
											userId: row.original.id,
										})),
									}),
							},
						]
			}
		/>
	);
};

export { UsersDataTableSelectActions };
