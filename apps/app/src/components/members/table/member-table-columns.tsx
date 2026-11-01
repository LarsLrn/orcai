import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import type { UserWithOrganizationRole } from "@orcai/schema";
import { Link, useRouteContext } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { RemoveMembersDialog } from "@/components/members/remove-members-dialog";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { createDataTableSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLinkItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenuTrigger } from "@/components/ui/shell/actions";
import { UserAvatar } from "@/components/users/user-avatar";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	UserWithOrganizationRole
>();

export const memberTableColumns = columnHelper.columns([
	createDataTableSelectColumn<UserWithOrganizationRole>(),
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
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const member = row.original;

			return <MemberActions member={member} />;
		},
	}),
]);

const MemberActions = ({ member }: { member: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canRemoveMember =
		member.id !== auth.user.id &&
		(member.organizationRole !== ORGANIZATION_ADMIN_ROLE ||
			canManageOrganization);
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<OverflowMenuTrigger variant="ghost" />} />
				<DropdownMenuContent align="end">
					<DropdownMenuLinkItem
						render={
							<Link
								to={"/app/members/$userId/edit"}
								params={{
									userId: member.id,
								}}
							/>
						}
					>
						{m.members_table_edit_action()}
					</DropdownMenuLinkItem>
					{canRemoveMember ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => setIsRemoveOpen(true)}
							>
								{m.members_remove_from_organisation_action()}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{canRemoveMember ? (
				<RemoveMembersDialog
					members={[
						member,
					]}
					open={isRemoveOpen}
					onOpenChange={setIsRemoveOpen}
				/>
			) : null}
		</>
	);
};
