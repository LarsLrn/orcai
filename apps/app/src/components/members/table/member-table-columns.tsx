import type { OrganizationMemberUser } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { RemoveMembersDialog } from "@/components/members/remove-members-dialog";
import { createDataTableActionsColumn } from "@/components/ui/data-table/data-table-actions-column";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { UserAvatar } from "@/components/users/user-avatar";
import { useMembershipControl } from "@/hooks/authz/use-membership-control";
import { getOrganizationRoleLabel } from "@/lib/labels/organization-role";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationMemberUser
>();

const useMemberRowActions = (member: OrganizationMemberUser) => {
	const canRemoveMember = useMembershipControl().canManageMember(member);
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);

	return {
		actions: [
			{
				key: "edit",
				label: m.members_table_edit_action(),
				linkProps: {
					to: "/app/members/$userId/edit",
					params: {
						userId: member.id,
					},
				},
			},
			canRemoveMember && {
				key: "remove",
				label: m.members_remove_from_organisation_action(),
				destructive: true,
				onClick: () => setIsRemoveOpen(true),
			},
		] satisfies (HeaderAction | false)[],
		dialog: canRemoveMember ? (
			<RemoveMembersDialog
				members={[
					member,
				]}
				open={isRemoveOpen}
				onOpenChange={setIsRemoveOpen}
			/>
		) : null,
	};
};

export const memberTableColumns = columnHelper.columns([
	createDataTableSelectColumn<OrganizationMemberUser>(),
	columnHelper.accessor("name", {
		size: 500,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<UserAvatar user={row.original} size="sm" />
				<Link
					to="/app/members/$userId/edit"
					params={{
						userId: row.original.id,
					}}
					className="font-medium hover:underline"
				>
					{row.original.name}
				</Link>
			</div>
		),
		meta: {
			label: m.common_name_label,
		},
	}),
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_email_label()} />
		),
		meta: {
			label: m.common_email_label,
		},
	}),
	columnHelper.accessor("emailVerified", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_table_email_verified_column_header()}
			/>
		),
		cell: ({ row }) =>
			row.original.emailVerified
				? m.members_verification_verified()
				: m.members_verification_not_verified(),
		meta: {
			label: m.members_table_email_verified_column_header,
		},
	}),
	columnHelper.accessor("organizationRole", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_organisation_role_label()}
			/>
		),
		cell: ({ row }) => getOrganizationRoleLabel(row.original.organizationRole),
		meta: {
			label: m.members_organisation_role_label,
		},
	}),
	createDataTableActionsColumn(useMemberRowActions),
]);
