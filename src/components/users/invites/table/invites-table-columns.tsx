import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clientEnv } from "@/lib/env/client";
import { orpc } from "@/lib/orpc/orpc";
import type { OrganizationInvitation } from "@/lib/orpc/schemas/organization-invitation";

export const invitesTableColumns: ColumnDef<OrganizationInvitation>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected()}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "email",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
	},
	{
		accessorKey: "id",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Invitation ID" />
		),
	},
	{
		accessorKey: "expiresAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expires At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.expiresAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		accessorKey: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
	},
	{
		accessorKey: "role",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Role" />
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => <ActionsCell invitation={row.original} />,
	},
];

const ActionsCell = ({
	invitation,
}: {
	invitation: OrganizationInvitation;
}) => {
	const router = useRouter();

	const handleCopyLink = (id: OrganizationInvitation["id"]) => {
		const location = router.buildLocation({
			to: "/register",
			search: { inv: id },
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
				<DeleteItem invitationId={invitation.id} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const DeleteItem = ({
	invitationId,
}: {
	invitationId: OrganizationInvitation["id"];
}) => {
	const { mutateAsync: deleteInvitations } = useMutation(
		orpc.organizationInvitation.delete.mutationOptions(),
	);

	const handleDelete = (id: OrganizationInvitation["id"]) => {
		toast.promise(
			// TODO: Replace with actual organizationId
			deleteInvitations({ organizationId: "placeholder", refs: [{ id }] }),
			{
				loading: "Deleting organization invitation...",
				success: "Organization invitation deleted",
				error: (error) => ({
					message: "Failed to delete organization invitation",
					description: error.message,
				}),
			},
		);
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
