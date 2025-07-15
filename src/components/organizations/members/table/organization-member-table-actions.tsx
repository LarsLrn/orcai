"use client";

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { ReplaceAllIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Organization } from "@/db/schema/auth";
import { authClient } from "@/lib/auth-client";

const OrganizationMemberTableActions = ({
	organizationId,
}: {
	organizationId: Organization["id"];
}) => {
	const { table } = useTable();

	const handleDelete = async () => {
		const userIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(
			Promise.all(
				userIds.map((userId) =>
					authClient.organization.removeMember({
						organizationId,
						memberIdOrEmail: userId,
					}),
				),
			),
			{
				loading: "Deleting organisation members...",
				success: "Organisation members deleted",
				error: (error) => ({
					message: "Failed to delete organisation members",
					description: error.message,
				}),
			},
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8">
					<ReplaceAllIcon />
					Actions
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px]">
				<DropdownMenuItem
					variant="destructive"
					onClick={handleDelete}
					disabled={table.getSelectedRowModel().rows.length === 0}
				>
					Remove selected members
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { OrganizationMemberTableActions };
