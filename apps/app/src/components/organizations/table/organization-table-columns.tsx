import type { Organization } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";

const columnHelper = createColumnHelper<DataTableFeatures, Organization>();

export const organizationTableColumns = columnHelper.columns([
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
			<DataTableColumnHeader column={column} title="Created" />
		),
		cell: ({ row }) => (
			<span>{formatDisplayTimestamp(row.original.createdAt || "")}</span>
		),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => <OrganizationRowActions organization={row.original} />,
	}),
]);

const OrganizationRowActions = ({
	organization,
}: {
	organization: Organization;
}) => {
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
						orgId: organization.id,
					}}
				>
					<DropdownMenuItem>View organisation</DropdownMenuItem>
				</Link>
				<Link
					to={"/app/orgs/$orgId/edit"}
					params={{
						orgId: organization.id,
					}}
				>
					<DropdownMenuItem>Edit Organisation</DropdownMenuItem>
				</Link>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
