import type { OrganizationId } from "@orcai/core";
import type { Organization } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
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
import { useDeleteOrganizationsMutation } from "@/hooks/mutations/use-organization-mutations";

const columnHelper = createColumnHelper<DataTableFeatures, Organization>();

export const organizationTableColumns = columnHelper.columns([
	createDataTableSelectColumn<Organization>(),
	columnHelper.accessor("name", {
		size: 500,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Name" />
		),
		cell: ({ row }) => (
			<Link
				to="/app/orgs/$orgId"
				params={{
					orgId: row.original.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.name}
			</Link>
		),
	}),
	columnHelper.accessor("slug", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Slug" />
		),
	}),
	columnHelper.accessor("createdAt", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const organization = row.original;

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
						<Link
							to={"/app/orgs/$orgId"}
							params={{
								orgId: row.original.id,
							}}
						>
							<DropdownMenuItem>View Organisation</DropdownMenuItem>
						</Link>
						<Link
							to={"/app/orgs/$orgId/edit"}
							params={{
								orgId: row.original.id,
							}}
						>
							<DropdownMenuItem>Edit Organisation</DropdownMenuItem>
						</Link>
						<DropdownMenuSeparator />
						<DeleteItem organizationId={organization.id} />
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	}),
]);

const DeleteItem = ({ organizationId }: { organizationId: OrganizationId }) => {
	const { mutate: deleteOrganizations } = useDeleteOrganizationsMutation();

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				deleteOrganizations({
					refs: [
						{
							id: organizationId,
						},
					],
				})
			}
		>
			Delete Organization
		</DropdownMenuItem>
	);
};
