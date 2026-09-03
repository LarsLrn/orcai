import type { OrganizationInvitationId } from "@orcai/core";
import type { OrganizationInvitation } from "@orcai/schema";
import { useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
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

const columnHelper = createColumnHelper<
	DataTableFeatures,
	OrganizationInvitation
>();

export const invitesTableColumns = columnHelper.columns([
	createDataTableSelectColumn<OrganizationInvitation>(),
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		meta: {
			exportLabel: "Email",
		},
	}),
	columnHelper.accessor("id", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Invitation ID" />
		),
		meta: {
			exportLabel: "Invitation ID",
		},
	}),
	columnHelper.accessor("expiresAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expires At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.expiresAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
		meta: {
			exportLabel: "Expires At",
		},
	}),
	columnHelper.accessor("status", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		meta: {
			exportLabel: "Status",
		},
	}),
	columnHelper.accessor("role", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Role" />
		),
		meta: {
			exportLabel: "Role",
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
			loading: "Copying invitation link...",
			success: "Invitation link copied",
			error: (error) => ({
				message: "Failed to copy invitation link",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" className="size-8 p-0">
						<span className="sr-only">Open menu</span>
						<MoreHorizontal className="size-4" />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => handleCopyLink(invitation.id)}>
					Copy Invitation Link
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DeleteItem
					invitationId={invitation.id}
					organizationId={invitation.organizationId}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteItem = ({
	invitationId,
	organizationId,
}: {
	invitationId: OrganizationInvitationId;
	organizationId: OrganizationInvitation["organizationId"];
}) => {
	const { mutate: deleteInvitations } =
		useDeleteOrganizationInvitationsMutation();

	const handleDelete = (id: OrganizationInvitationId) => {
		deleteInvitations({
			organizationId,
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
			onClick={() => handleDelete(invitationId)}
		>
			Delete Organization Invitation
		</DropdownMenuItem>
	);
};
