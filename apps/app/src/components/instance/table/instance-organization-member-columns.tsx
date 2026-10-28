import type { OrganizationId, UserId } from "@orcai/core";
import type { InstanceOrganizationMember } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	useChangeInstanceMemberRoleMutation,
	useRemoveInstanceMemberMutation,
} from "@/hooks/mutations/use-instance-membership-mutations";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<
	DataTableFeatures,
	InstanceOrganizationMember
>();

const RoleCell = ({
	organizationId,
	member,
}: {
	organizationId: OrganizationId;
	member: InstanceOrganizationMember;
}) => {
	const changeRole = useChangeInstanceMemberRoleMutation();

	return (
		<OrganizationRolePicker
			value={member.role}
			disabled={changeRole.isPending}
			onValueChange={(role) =>
				changeRole.mutate({
					organizationId,
					userId: member.userId,
					role,
				})
			}
		/>
	);
};

const RemoveCell = ({
	organizationId,
	member,
	viewerId,
}: {
	organizationId: OrganizationId;
	member: InstanceOrganizationMember;
	viewerId: UserId;
}) => {
	const self = member.userId === viewerId;
	const remove = useRemoveInstanceMemberMutation({
		name: member.name,
		self,
	});

	return (
		<Button
			variant="ghost"
			size="sm"
			loading={remove.isPending}
			onClick={() =>
				remove.mutate({
					organizationId,
					userId: member.userId,
				})
			}
		>
			{self ? m.instance_org_member_leave_action() : m.common_remove_button()}
		</Button>
	);
};

/** Members with their role and a remove action; the viewer's own row reads Leave. */
export const instanceOrganizationMemberColumns = (
	organizationId: OrganizationId,
	viewerId: UserId,
) =>
	columnHelper.columns([
		columnHelper.accessor("name", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title={m.common_name_label()} />
			),
			cell: ({ row }) => (
				<span className="flex items-center gap-2">
					<Link
						to="/instance/users/$userId"
						params={{
							userId: row.original.userId,
						}}
						className="font-medium hover:underline"
					>
						{row.original.name}
					</Link>
					{row.original.banned && (
						<Badge variant="destructive">
							{m.instance_users_table_status_banned_label()}
						</Badge>
					)}
				</span>
			),
			meta: {
				label: m.common_name_label,
			},
		}),
		columnHelper.accessor("email", {
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title={m.common_email_label()} />
			),
			cell: ({ row }) => (
				<Link
					to="/instance/users/$userId"
					params={{
						userId: row.original.userId,
					}}
					className="hover:underline"
				>
					{row.original.email}
				</Link>
			),
			meta: {
				label: m.common_email_label,
			},
		}),
		columnHelper.accessor("role", {
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title={m.instance_detail_role_column_header()}
				/>
			),
			cell: ({ row }) => (
				<RoleCell organizationId={organizationId} member={row.original} />
			),
			meta: {
				label: m.instance_detail_role_column_header,
			},
		}),
		columnHelper.accessor("joinedAt", {
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title={m.instance_detail_joined_column_header()}
				/>
			),
			cell: ({ row }) =>
				row.original.joinedAt ? formatDisplayDate(row.original.joinedAt) : null,
			meta: {
				label: m.instance_detail_joined_column_header,
			},
		}),
		columnHelper.display({
			id: "actions",
			enableSorting: false,
			enableHiding: false,
			cell: ({ row }) => (
				<RemoveCell
					organizationId={organizationId}
					member={row.original}
					viewerId={viewerId}
				/>
			),
		}),
	]);
