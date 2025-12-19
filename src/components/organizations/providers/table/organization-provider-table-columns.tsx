import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { orpc } from "@/lib/orpc/orpc";
import type { OrganizationProvider } from "@/lib/orpc/schemas/organization-provider";

export const organizationProviderTableColumns: ColumnDef<OrganizationProvider>[] =
	[
		{
			id: "select",
			size: 32,
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
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
			size: 300,
			accessorKey: "providerSlug",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Provider" />
			),
		},
		{
			accessorKey: "enabled",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Enabled" />
			),
			cell: ({ row }) => (
				<span
					className={row.original.enabled ? "text-green-600" : "text-red-600"}
				>
					{row.original.enabled ? "Yes" : "No"}
				</span>
			),
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Created At" />
			),
			cell: ({ row }) => (
				<span>
					{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}
				</span>
			),
		},
		{
			accessorKey: "updatedAt",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Updated At" />
			),
			cell: ({ row }) => (
				<span>
					{format(row.original.updatedAt || "", "MMM dd, yyyy HH:mm")}
				</span>
			),
		},
		{
			id: "actions",
			size: 32,
			cell: ({ row }) => {
				const provider = row.original;

				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="size-8 p-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<Link
								to={"/app/orgs/$orgId/providers/$providerSlug"}
								params={{
									orgId: row.original.organizationId,
									providerSlug: row.original.providerSlug,
								}}
							>
								<DropdownMenuItem>View Provider</DropdownMenuItem>
							</Link>
							<Link
								to={"/app/orgs/$orgId/providers/$providerSlug/edit"}
								params={{
									orgId: row.original.organizationId,
									providerSlug: row.original.providerSlug,
								}}
							>
								<DropdownMenuItem>Edit Provider</DropdownMenuItem>
							</Link>
							<DropdownMenuSeparator />
							<DeleteItem provider={provider} />
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];

const DeleteItem = ({ provider }: { provider: OrganizationProvider }) => {
	const { mutateAsync: deleteProviders } = useMutation(
		orpc.organizationProvider.delete.mutationOptions(),
	);

	const handleDelete = (provider: OrganizationProvider) => {
		toast.promise(
			deleteProviders({
				refs: [{ providerSlug: provider.providerSlug }],
			}),
			{
				loading: "Deleting provider...",
				success: "Provider deleted",
				error: (error) => ({
					message: "Failed to delete provider",
					description: error.message,
				}),
			},
		);
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(provider)}
		>
			Delete Provider
		</DropdownMenuItem>
	);
};
