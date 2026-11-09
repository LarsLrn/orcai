import type { OrganizationInvitation } from "@orcai/schema";
import { useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { toast } from "sonner";
import { DisplayTimestamp } from "@/components/ui/composed/display-time";
import { createDataTableActionsColumn } from "@/components/ui/data-table/data-table-actions-column";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useMembershipControl } from "@/hooks/authz/use-membership-control";
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationInvitation
>();

const useInvitationRowActions = (invitation: OrganizationInvitation) => {
	const router = useRouter();
	const { mutate: deleteInvitations } =
		useDeleteOrganizationInvitationsMutation({
			names: [
				`for ${invitation.email}`,
			],
		});
	const canDeleteInvitation = useMembershipControl().canManageRole(
		invitation.role,
	);

	const copyLink = () => {
		const location = router.buildLocation({
			to: "/register",
			search: {
				inv: invitation.id,
			},
		});
		const href = location.maskedLocation?.publicHref ?? location.publicHref;
		const fullUrl = new URL(href, window.location.origin).toString();

		toast.promise(navigator.clipboard.writeText(fullUrl), {
			loading: m.members_invitations_copy_link_toast_loading(),
			success: m.members_invitations_copy_link_toast_success(),
			error: (error) => ({
				message: m.members_invitations_copy_link_toast_error(),
				description: reasonMessageOf(error),
			}),
		});
	};

	return {
		actions: [
			{
				key: "copy-link",
				label: m.members_invitations_table_copy_link_action(),
				onClick: copyLink,
			},
			canDeleteInvitation && {
				key: "delete",
				label: m.members_invitations_table_delete_action(),
				destructive: true,
				onClick: () =>
					deleteInvitations({
						refs: [
							{
								id: invitation.id,
							},
						],
					}),
			},
		] satisfies (HeaderAction | false)[],
	};
};

export const invitationsTableColumns = columnHelper.columns([
	createDataTableSelectColumn<OrganizationInvitation>(),
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_email_label()} />
		),
		meta: {
			label: m.common_email_label,
		},
	}),
	columnHelper.accessor("id", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_invitations_table_id_column_header()}
			/>
		),
		meta: {
			label: m.members_invitations_table_id_column_header,
		},
	}),
	columnHelper.accessor("expiresAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_invitations_table_expires_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span>
				<DisplayTimestamp value={row.original.expiresAt || ""} />
			</span>
		),
		meta: {
			label: m.members_invitations_table_expires_column_header,
		},
	}),
	columnHelper.accessor("status", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_invitations_table_status_column_header()}
			/>
		),
		meta: {
			label: m.members_invitations_table_status_column_header,
		},
	}),
	columnHelper.accessor("role", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_invitations_table_role_column_header()}
			/>
		),
		meta: {
			label: m.members_invitations_table_role_column_header,
		},
	}),
	createDataTableActionsColumn(useInvitationRowActions),
]);
