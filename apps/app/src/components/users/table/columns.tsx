import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import type { UserWithOrganizationRole } from "@orcai/schema";
import { Link, useRouteContext } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
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
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useDeleteOrganizationMembersMutation } from "@/hooks/mutations/use-organization-member-mutations";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	UserWithOrganizationRole
>();

export const columns = columnHelper.columns([
	createDataTableSelectColumn<UserWithOrganizationRole>(),
	columnHelper.accessor("name", {
		size: 500,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_name_label()} />
		),
		cell: ({ row }) => (
			<Link
				to="/app/users/$userId/edit"
				params={{
					userId: row.original.id,
				}}
				className="font-medium hover:underline"
			>
				{row.original.name}
			</Link>
		),
	}),
	columnHelper.accessor("email", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title={m.common_email_label()} />
		),
	}),
	columnHelper.accessor("emailVerified", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.users_table_email_verified_column_header()}
			/>
		),
		cell: ({ row }) =>
			row.original.emailVerified
				? m.users_verification_verified()
				: m.users_verification_not_verified(),
	}),
	columnHelper.accessor("organizationRole", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.users_organisation_role_label()}
			/>
		),
		cell: ({ row }) => getOrganizationRoleLabel(row.original.organizationRole),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const user = row.original;

			return <UserActions user={user} />;
		},
	}),
]);

const UserActions = ({ user }: { user: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canRemoveUser =
		user.id !== auth.user.id &&
		(user.organizationRole !== ORGANIZATION_ADMIN_ROLE ||
			canManageOrganization);

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
				<Link
					to={"/app/users/$userId/edit"}
					params={{
						userId: user.id,
					}}
				>
					<DropdownMenuItem>{m.users_table_edit_action()}</DropdownMenuItem>
				</Link>
				{canRemoveUser ? (
					<>
						<DropdownMenuSeparator />
						<RemoveItem user={user} />
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const RemoveItem = ({ user }: { user: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { mutate: removeMembers } = useDeleteOrganizationMembersMutation(
		{},
		{
			names: [
				user.email,
			],
		},
	);
	const organizationId = auth.session.activeOrganizationId;

	if (!organizationId) {
		return null;
	}

	return (
		<DropdownMenuItem
			variant="destructive"
			onClick={() =>
				removeMembers({
					organizationId,
					refs: [
						{
							userId: user.id,
						},
					],
				})
			}
		>
			{m.users_remove_from_organisation_action()}
		</DropdownMenuItem>
	);
};
