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
import type { Organization } from "@/db/schema/organization";
import { organizationQueryOptions } from "@/lib/query-options/organization";

export const organizationTableColumns: ColumnDef<Organization>[] = [
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
		size: 500,
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
	},
	{
		accessorKey: "slug",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Slug" />
		),
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => {
			const organization = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<Link to={"/app/orgs/$orgId"} params={{ orgId: row.original.id }}>
							<DropdownMenuItem>View Organisation</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/orgs/$orgId/edit"}
							params={{ orgId: row.original.id }}
						>
							<DropdownMenuItem>Edit Organisation</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem organizationId={organization.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];

const DeleteItem = ({
	organizationId,
}: {
	organizationId: Organization["id"];
}) => {
	const { mutateAsync: deleteOrganizations } = useMutation(
		organizationQueryOptions.delete(),
	);

	const handleDelete = (id: Organization["id"]) => {
		toast.promise(deleteOrganizations({ refs: [{ id }] }), {
			loading: "Deleting organization...",
			success: "Organization deleted",
			error: (error) => ({
				message: "Failed to delete organization",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() => handleDelete(organizationId)}
		>
			Delete Organization
		</DropdownMenuItem>
	);
};
