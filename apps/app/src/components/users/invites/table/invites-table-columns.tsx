import type { OrganizationInvitationId } from "@orcai/core";
import type { OrganizationInvitation } from "@orcai/schema";
import { useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { clientEnv } from "@/lib/env/client";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationInvitation
>();

export const invitesTableColumns = columnHelper.columns([
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
				title={m.users_invites_table_id_column_header()}
			/>
		),
		meta: {
			label: m.users_invites_table_id_column_header,
		},
	}),
	columnHelper.accessor("expiresAt", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.users_invites_table_expires_column_header()}
			/>
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.expiresAt || "")}</span>
		),
		meta: {
			label: m.users_invites_table_expires_column_header,
		},
	}),
	columnHelper.accessor("status", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.users_invites_table_status_column_header()}
			/>
		),
		meta: {
			label: m.users_invites_table_status_column_header,
		},
	}),
	columnHelper.accessor("role", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.users_invites_table_role_column_header()}
			/>
		),
		meta: {
			label: m.users_invites_table_role_column_header,
		},
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => <ActionsCell invitation={row.original} />,
	}),
]);

const ActionsCell = ({
	invitation,
}: {
	invitation: OrganizationInvitation;
}) => {
	const router = useRouter();

	const handleCopyLink = (id: OrganizationInvitationId) => {
		const location = router.buildLocation({
			to: "/register",
			search: {
				inv: id,
			},
		});
		const href = location.maskedLocation?.publicHref ?? location.publicHref;
		const fullUrl = new URL(href, clientEnv.VITE_BASE_URL).toString();

		toast.promise(navigator.clipboard.writeText(fullUrl), {
			loading: m.users_invites_copy_link_toast_loading(),
			success: m.users_invites_copy_link_toast_success(),
			error: (error) => ({
				message: m.users_invites_copy_link_toast_error(),
				description: reasonMessageOf(error),
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" className="size-8 p-0">
						<span className="sr-only">{m.common_row_menu_trigger()}</span>
						<MoreHorizontal className="size-4" />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => handleCopyLink(invitation.id)}>
					{m.users_invites_table_copy_link_action()}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DeleteItem invitation={invitation} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteItem = ({ invitation }: { invitation: OrganizationInvitation }) => {
	const { mutate: deleteInvitations } =
		useDeleteOrganizationInvitationsMutation(
			{},
			{
				names: [
					`for ${invitation.email}`,
				],
			},
		);

	const handleDelete = (id: OrganizationInvitationId) => {
		deleteInvitations({
			refs: [
				{
					id,
				},
			],
		});
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(invitation.id)}
		>
			{m.users_invites_table_delete_action()}
		</DropdownMenuItem>
	);
};
